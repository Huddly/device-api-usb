#pragma once

#include "libusb.h"

#include <cassert>
#include <iostream>
#include <memory>
#include <string>
#include <variant>
#include <vector>

struct Libusb_error {
	explicit Libusb_error(int number) : number(number) {}
	int const number;
	std::string get_message() const {return libusb_error_name(number);}
};

struct Libusb {
    static std::variant<Libusb, Libusb_error> init() {
        libusb_context *ctx;
        int const r = libusb_init(&ctx);
        if (r != 0) {
            std::cerr << "Libusb: libusb_init failed: " << r << std::endl;
            return Libusb_error(r);
        }
		libusb_set_option(ctx, LIBUSB_OPTION_USE_USBDK);
        return Libusb(ctx);
    }
private:
    struct Inner {
        explicit Inner(libusb_context * ctx) : ctx(ctx) {}
		Inner(Inner &&) = delete;
		Inner(Inner const &) = delete;
        Inner& operator=(Inner const &) = delete;
        Inner& operator=(Inner &&) = delete;
        ~Inner() {
            std::cout << "Libusb: libusb_exit" << std::endl;
            libusb_exit(ctx);
        }
        libusb_context * const ctx;
    };
    explicit Libusb(libusb_context *ctx) : inner(std::make_shared<Inner>(ctx)) {}
	explicit Libusb(std::shared_ptr<Inner> inner) : inner(std::move(inner)) {}
    std::shared_ptr<Inner> inner;
public:
    struct Config_descriptor {
        Config_descriptor(std::shared_ptr<Libusb::Inner> inner, libusb_config_descriptor * desc)
            : desc(desc), inner(std::move(inner)) {}
        Config_descriptor(Config_descriptor const &) = delete;
        Config_descriptor operator=(Config_descriptor const &) = delete;
        Config_descriptor operator=(Config_descriptor &&) = delete;
        ~Config_descriptor() {
			if (desc != nullptr) {
				libusb_free_config_descriptor(desc);
			}
        }
		Config_descriptor(Config_descriptor && other) noexcept : desc(other.desc), inner(other.inner) {
			other.desc = nullptr;
		}
        libusb_config_descriptor * desc;
    private:
        std::shared_ptr<Libusb::Inner> const inner;
    };
    struct Device {
        explicit Device(std::shared_ptr<Libusb::Inner> inner, libusb_device * dev)
            : dev(dev)
            , inner(std::move(inner))
        {
			//std::cout << "Libusb: libusb_ref_device " << dev << std::endl;
			assert(this->inner != nullptr);
            libusb_ref_device(dev);
        }
        Device(Device const & other) : dev(other.dev), inner(other.inner) {
            //std::cout << "Libusb: device copied" << std::endl;
            assert(dev != nullptr);
            libusb_ref_device(dev);
        }
		Device(Device && other) noexcept : dev(other.dev), inner(std::move(other.inner)) {
			//std::cout << "Libusb: device moved" << std::endl;
            assert(dev != nullptr);
			other.dev = nullptr;
        }
        Device &operator=(Device const &other) noexcept {
            //std::cout << "Libusb: device assignment copied" << std::endl;
            assert(other.dev != nullptr);
            inner = other.inner;
            dev = other.dev;
            libusb_ref_device(dev);
            return *this;
        }
        Device &operator=(Device && other) noexcept {
            //std::cout << "Libusb: device assignment moved" << std::endl;
            assert(other.dev != nullptr);
            inner = std::move(other.inner);
            dev = other.dev;
            other.dev = nullptr;
            return *this;
        };

        bool operator==(Device const & other) const noexcept {
            auto const thisdev = get_device_descriptor();
            auto const odev = other.get_device_descriptor();
            if (thisdev.idProduct != odev.idProduct
                || thisdev.idVendor != odev.idVendor) {
                return false;
            }
            if (get_address() != other.get_address()) {
                return false;
            }
            auto const thisloc = get_location();
            auto const oloc = other.get_location();
            if (thisloc.size() != oloc.size()) {
                return false;
            }
            for (auto i = 0u; i < thisloc.size(); i++) {
                if (thisloc[i] != oloc[i]) {
                    return false;
                }
            }
            return true;
        }

        bool operator<(Device const & other) const noexcept {
            auto const thisdev = get_device_descriptor();
            auto const odev = other.get_device_descriptor();
            if (thisdev.idProduct != odev.idProduct) {
                return thisdev.idProduct < odev.idProduct;
            }
            if (thisdev.idVendor != odev.idVendor) {
                return thisdev.idVendor < odev.idVendor;
            }
            auto const thisa = get_address();
            auto const oa /*hele natten*/ = other.get_address();
            if (thisa != oa) {
                return thisa < oa;
            }
            auto const thisloc = get_location();
            auto const oloc = other.get_location();
            if (thisloc.size() != oloc.size()) {
                return thisloc.size() < oloc.size();
            }
            for (auto i = 0u; i < thisloc.size(); i++) {
                if (thisloc[i] != oloc[i]) {
                    return thisloc[i] < oloc[i];
                }
            }
            return false;
        }

		~Device() {
			if (dev == nullptr) {
				return;
			}
			//std::cout << "Libusb: libusb_unref_device " << dev << std::endl;
			libusb_unref_device(dev);
		}
        class Open {
            struct Inner {
                Inner(std::shared_ptr<Libusb::Inner> ctx, libusb_device_handle * devh, bool silent)
                    : ctx(std::move(ctx)), devh(devh), silent(silent) {}
                Inner(Inner &&) = delete;
                Inner(Inner const &) = delete;
                Inner operator=(Inner const &) = delete;
                Inner operator=(Inner &&) = delete;
                ~Inner() {
                    if (!silent) {
                        std::cout << "Libusb: libusb_close" << std::endl;
                    }
                    libusb_close(devh);
                }
                std::shared_ptr<Libusb::Inner> const ctx;
                libusb_device_handle * const devh;
                bool const silent;
            };
            std::shared_ptr<Inner> const inner;
        public:
            Open(std::shared_ptr<Libusb::Inner> ctx, libusb_device_handle * devh, bool silent)
                : inner(std::make_shared<Inner>(ctx, devh, silent)) {}
            struct Claimed_interface {
                Claimed_interface(std::shared_ptr<Inner> inner, int interface_number)
                    : interface_number(interface_number), inner(std::move(inner)) {}
				Claimed_interface(Claimed_interface && other) noexcept
                    : interface_number(other.interface_number), inner(std::move(other.inner)) {}
				Claimed_interface(Claimed_interface const &) = delete;
				Claimed_interface& operator=(Claimed_interface const &) = delete;
                ~Claimed_interface() {
					if (inner == nullptr) {
						return;
					}
                    std::cout << "Libusb: libusb_release_interface" << std::endl;
                    int const r = libusb_release_interface(inner->devh, interface_number);
                    if (r != 0) {
                        std::cerr << "Libusb: libusb_release_interface failed: " << r << std::endl;
                    }
                }
                int const interface_number;
            private:
                std::shared_ptr<Inner> inner;
            };
            std::variant<Claimed_interface, Libusb_error> claim_interface(int interface_number) {
                int const r = libusb_claim_interface(inner->devh, interface_number);
                if (r < 0) {
                    std::cerr << "Libusb: libusb_claim_interface failed: " << r << std::endl;
                    return Libusb_error(r);
                }
                return Claimed_interface(inner, interface_number);
            }
            struct Endpoint {
                Endpoint(std::shared_ptr<Inner> inner, uint8_t ep) : ep_out(ep & ~0x80u), ep_in(ep | 0x80u), inner(std::move(inner)) {}
                Endpoint(std::shared_ptr<Inner> inner, uint8_t ep_out, uint8_t ep_in) : ep_out(ep_out), ep_in(ep_in), inner(std::move(inner)) {
                    assert((ep_in & 0x80u) == 0x80u);
                    assert((ep_out & 0x80u) == 0x00u);
                }
                std::variant<int, Libusb_error> out(uint8_t const *data, int length, unsigned timeout) const {
                    return bulk_transfer(ep_out, const_cast<uint8_t *>(data), length, timeout);
                }
                std::variant<int, Libusb_error> in(uint8_t *data, int length, unsigned timeout) const {
                    return bulk_transfer(ep_in | 0x80, data, length, timeout);
                }
                std::variant<std::monostate, Libusb_error> out_clear_halt() const {
                    int const r = libusb_clear_halt(inner->devh, ep_out);
                    if (r != 0) {
                        return Libusb_error(r);
                    }
                    return std::monostate();
                }
                std::variant<std::monostate, Libusb_error> in_clear_halt() const {
                    int const r = libusb_clear_halt(inner->devh, ep_in);
                    if (r != 0) {
                        return Libusb_error(r);
                    }
                    return std::monostate();
                }
                uint8_t const ep_out;
                uint8_t const ep_in;
				Libusb get_context() const { return Libusb(inner->ctx); }
            private:
                std::variant<int, Libusb_error> bulk_transfer(uint8_t ep, unsigned char *data, int length, unsigned int timeout) const {
                    int actual_length = 0;
                    int const r = libusb_bulk_transfer(inner->devh, ep, data, length, &actual_length, timeout);
                    if (r < 0) {
                        Libusb_error err(r);
                        switch (r) {
                        case LIBUSB_ERROR_TIMEOUT:
                            if (actual_length != 0 && actual_length != length && (ep_in & 0x80) != 0) {
                                //std::cerr << "Uh, oh. Transferred " << actual_length << " bytes on timeout" << std::endl;
                                return actual_length;
                            }
                            break;
                        default:
                            std::cerr << "Libusb: libusb_bulk_transfer failed: " << err.get_message() << std::endl;
                            break;
                        }
                        return err;
                    }
                    return actual_length;
                }
                std::shared_ptr<Inner> const inner;
            };
            Endpoint get_endpoint(uint8_t endpoint) const {
                return Endpoint(inner, endpoint);
            }
            Endpoint get_endpoint(uint8_t ep_out, uint8_t ep_in) const {
                return Endpoint(inner, ep_out, ep_in);
            }
            std::variant<std::string, Libusb_error> get_string_descriptor(uint8_t index) {
                std::string ret(1024, '\0');
                auto const r = libusb_get_string_descriptor_ascii(
                    inner->devh, index, reinterpret_cast<unsigned char *>(ret.data()), ret.size());
                if (r < 0) {
                    Libusb_error err(r);
                    if (!inner->silent) {
                        std::cerr << "Libusb: Error getting string descriptor: " << err.get_message() << std::endl;
                    }
                    return err;
                }
                ret.resize(r);
                return ret;
            }
        };
        std::variant<Open, Libusb_error> open(bool silent=false) {
            assert(dev != nullptr);
			assert(inner != nullptr);
            libusb_device_handle *devh = nullptr;
            if (!silent) {
                std::cout << "Libusb: libusb_open" << std::endl;
            }
            int const r = libusb_open(dev, &devh);
            if (r != 0) {
                Libusb_error const err(r);
                if (!silent) {
                    std::cout << "Libusb: libusb_open failed: " << err.get_message() << std::endl;
                }
                return err;

            }
            return Open(inner, devh, silent);
        }
        libusb_device_descriptor get_device_descriptor() const noexcept {
            assert(dev != nullptr);
            libusb_device_descriptor ret{};
            auto const r = libusb_get_device_descriptor(dev, &ret);
            static_assert(LIBUSB_API_VERSION >= 0x01000102);
            assert(r == 0); // Always succeeds, according to docs.
            return ret;
        }
        std::variant<Config_descriptor, Libusb_error> get_active_config_descriptor() const {
			assert(inner != nullptr);
            libusb_config_descriptor *config = nullptr;
            int const r = libusb_get_active_config_descriptor(dev, &config);
            if (r != 0) {
                std::cerr << "Libusb: libusb_get_active_config_descriptor failed: " << r << std::endl;
                return Libusb_error(r);
            }
            return Config_descriptor(inner, config);
        }
        uint8_t get_address() const noexcept {
            assert(dev != nullptr);
            return libusb_get_device_address(dev);
        }
        std::vector<uint8_t> get_location() const noexcept {
            assert(dev != nullptr);
            static_assert(LIBUSB_API_VERSION >= 0x01000102);
            std::vector<uint8_t> ret(8);
            ret[0] = libusb_get_bus_number(dev);
            auto const pnret = libusb_get_port_numbers(dev, &ret[1], ret.size() - 1);
            assert(pnret >= 0); // Always succeeds.
            ret.resize(pnret + 1);
            return ret;
        }
    private:
        libusb_device * dev;
        std::shared_ptr<Libusb::Inner> inner;
    };
    struct Device_list {
        explicit Device_list(std::shared_ptr<Libusb::Inner> inner, libusb_device **devs, size_t count)
            : count(count)
            , devs(devs)
            , inner(std::move(inner))
        {
                //std::cout << "Libusb: making device list" << std::endl;
        }
        Device_list(Device_list && other) noexcept
            : count(other.count)
            , devs(other.devs)
            , inner(std::move(other.inner)) {
                other.devs = nullptr;
            }
        Device_list(Device_list const &) = delete;
        Device_list operator=(Device_list const &) = delete;
        Device_list operator=(Device_list &&) = delete;
        ~Device_list() {
            if (devs == nullptr) {
                return;
            }
			//std::cout << "Libusb: libusb_free_device_list" << std::endl;
            libusb_free_device_list(devs, 1);
        }
        Device at(size_t n) {
            assert(n < count);
			assert(inner != nullptr);
            return Device(inner, devs[n]);
        }
        size_t const count;
    private:
        libusb_device ** devs;
        std::shared_ptr<Libusb::Inner> inner;
    };
    std::variant<Device_list, Libusb_error> get_device_list() {
        libusb_device **devs;
        ssize_t cnt = libusb_get_device_list(inner->ctx, &devs);
        if (cnt < 0) {
            std::cerr << "Libusb: libusb_get_device_list failed: " << cnt << std::endl;
            return Libusb_error(static_cast<int>(cnt));
        }
        return Device_list(inner, devs, static_cast<size_t>(cnt));
    };
};
