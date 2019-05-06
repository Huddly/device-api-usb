#include "Libusb.hpp"

namespace libusb::internal {
    struct Inner {
        explicit Inner(libusb_context * ctx) : ctx(ctx) {}
        Inner(Inner &&) = delete;
        Inner(Inner const &) = delete;
        Inner& operator=(Inner const &) = delete;
        Inner& operator=(Inner &&) = delete;
        ~Inner() {
            libusb_exit(ctx);
        }
        libusb_context * const ctx;
    };

    struct Open_inner {
        Open_inner(std::shared_ptr<Inner> ctx, libusb_device_handle * devh, bool silent)
            : ctx(std::move(ctx)), devh(devh), silent(silent) {}
        Open_inner(Open_inner &&) = delete;
        Open_inner(Open_inner const &) = delete;
        Open_inner operator=(Open_inner const &) = delete;
        Open_inner operator=(Open_inner &&) = delete;
        ~Open_inner() {
            libusb_close(devh);
        }
        std::shared_ptr<Inner> const ctx;
        libusb_device_handle *devh;
        bool const silent;
    };
};

std::variant<Libusb, libusb::Error> Libusb::init()
{
    libusb_context *ctx;
    int const r = libusb_init(&ctx);
    if (r != 0) {
        libusb::Error err(r);
        std::cerr << "Libusb: libusb_init failed: " << err.get_message() << std::endl;
        return std::move(err);
    }
    libusb_set_option(ctx, LIBUSB_OPTION_USE_USBDK);
    return Libusb(ctx);
}

Libusb::Libusb(libusb_context *ctx)
    : inner(std::make_shared<libusb::internal::Inner>(ctx)) {}

std::variant<libusb::Device_list, libusb::Error> Libusb::get_device_list() {
    libusb_device **devs;
    ssize_t cnt = libusb_get_device_list(inner->ctx, &devs);
    if (cnt < 0) {
        std::cerr << "Libusb: libusb_get_device_list failed: " << cnt << std::endl;
        return libusb::Error(static_cast<int>(cnt));
    }
    return libusb::Device_list(inner, devs, static_cast<size_t>(cnt));
};

Libusb libusb::Endpoint::get_context() const {
    return Libusb(inner->ctx);
}

libusb::Open_device::Open_device(std::shared_ptr<libusb::internal::Inner> ctx, libusb_device_handle * devh, bool silent)
    : inner(std::make_shared<libusb::internal::Open_inner>(ctx, devh, silent)) {}

std::variant<libusb::Claimed_interface, libusb::Error> libusb::Open_device::claim_interface(int interface_number) {
    int const r = libusb_claim_interface(inner->devh, interface_number);
    if (r < 0) {
        libusb::Error err(r);
        std::cerr << "Libusb: libusb_claim_interface failed: " << err.get_message() << std::endl;
        return std::move(err);
    }
    return libusb::Claimed_interface(inner, interface_number);
}


std::variant<std::monostate, libusb::Error> libusb::Endpoint::out_clear_halt() const {
    int const r = libusb_clear_halt(inner->devh, ep_out);
    if (r != 0) {
        return libusb::Error(r);
    }
    return std::monostate();
}

std::variant<std::monostate, libusb::Error> libusb::Endpoint::in_clear_halt() const {
    int const r = libusb_clear_halt(inner->devh, ep_in);
    if (r != 0) {
        return libusb::Error(r);
    }
    return std::monostate();
}

std::variant<int, libusb::Error>  libusb::Endpoint::bulk_transfer(uint8_t ep, unsigned char *data, int length, unsigned int timeout) const {
    int actual_length = 0;
    int const r = libusb_bulk_transfer(inner->devh, ep, data, length, &actual_length, timeout);
    if (r < 0) {
        libusb::Error err(r);
        switch (r) {
        case LIBUSB_ERROR_TIMEOUT:
            if (actual_length != 0 && actual_length != length && (ep_in & 0x80) != 0) {
                //std::cerr << "Uh, oh. Transferred " << actual_length << " bytes on timeout" << std::endl;
                return actual_length;
            }
            break;
        default:
            //std::cerr << "Libusb: libusb_bulk_transfer failed: " << err.get_message() << std::endl;
            break;
        }
        return err;
    }
    return actual_length;
}

std::variant<std::string, libusb::Error> libusb::Open_device::get_string_descriptor(uint8_t index) {
    std::string ret(1024, '\0');
    auto const r = libusb_get_string_descriptor_ascii(
        inner->devh, index, reinterpret_cast<unsigned char *>(ret.data()), ret.size());
    if (r < 0) {
        libusb::Error err(r);
        if (!inner->silent) {
            std::cerr << "Libusb: Error getting string descriptor: " << err.get_message() << std::endl;
        }
        return err;
    }
    ret.resize(r);
    return ret;
}

libusb::Claimed_interface::~Claimed_interface() {
    if (inner == nullptr) {
        return;
    }
    int const r = libusb_release_interface(inner->devh, interface_number);
    if (r != 0) {
        //std::cerr << "Libusb: libusb_release_interface failed: " << r << std::endl;
    }
}
