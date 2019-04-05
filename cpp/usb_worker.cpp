#include "usb_worker.hpp"
#include <libusb.h>
#include "find_interface.hpp"

#include <variant>
#include <thread>
#include <chrono>
#include <unordered_map>

struct ListDevices {
    ListDevices(std::function<void(int, std::vector<Usb_device>)> cb) : cb(std::move(cb)) {}
    ListDevices(ListDevices const &o) : cb(o.cb) {};
    ListDevices(ListDevices && o) : cb(std::move(o.cb)) {}
    std::function<void(int, std::vector<Usb_device>)> const cb;
};

struct OpenDevice {
    OpenDevice(Usb_cookie cookie, std::function<void(int, Usb_cookie)> cb)
        : cookie(cookie)
        , cb(std::move(cb)) {}
    Usb_cookie const cookie;
    std::function<void(int, Usb_cookie)> const cb;
};

struct WriteDevice {
    WriteDevice(Usb_cookie cookie, std::vector<uint8_t> data, unsigned timeout_ms, std::function<void(int, int)> cb)
        : cookie(cookie)
        , data(std::move(data))
        , timeout_ms(timeout_ms)
        , cb(std::move(cb)) {}
    Usb_cookie cookie;
    std::vector<uint8_t> data;
    unsigned timeout_ms;
    std::function<void(int, int)> cb;
};

struct ReadDevice {
    ReadDevice(Usb_cookie cookie, size_t max_size, unsigned timeout_ms, std::function<void(int, std::vector<uint8_t>)> cb)
        : cookie(cookie)
        , max_size(max_size)
        , timeout_ms(timeout_ms)
        , cb(std::move(cb)) {}
    Usb_cookie cookie;
    size_t max_size;
    unsigned timeout_ms;
    std::function<void(int, std::vector<uint8_t>)> cb;
};

struct CloseDevice {
    CloseDevice(Usb_cookie cookie, std::function<void(int)> cb)
        : cookie(cookie)
        , cb(std::move(cb)) {}
    Usb_cookie cookie;
    std::function<void(int)> cb;
};

typedef std::variant<ListDevices, OpenDevice, WriteDevice, ReadDevice, CloseDevice> CommandVariants;

struct WorkItem : public QueueItem {
    explicit WorkItem(std::string name, CommandVariants command)
        : name(std::move(name))
        , command(command) {}
    WorkItem(WorkItem const &) = delete;
    WorkItem(WorkItem &&) = delete;
    static WorkItem & upcast(QueueItemPtr & i) { return *static_cast<WorkItem *>(&*i); }
    static WorkItem const & upcast(std::shared_ptr<QueueItem> const & i) { return *static_cast<WorkItem const *>(&*i); }
    std::string get_name() const override { return name; }
    std::string const name;
    CommandVariants command;
};

struct ReturnItem : public QueueItem {
    explicit ReturnItem(std::string name, std::function<void(void)> cb)
        : name(std::move(name))
        , cb(std::move(cb)) {}
    static ReturnItem & upcast(QueueItemPtr & i) { return *static_cast<ReturnItem *>(&*i); }
    std::string get_name() const override { return name; }

    std::string const name;
    std::function<void(void)> const cb;
};

static std::string maybe_get_string(libusb::Device & dev, uint8_t string, int retry=3) {
    auto maybe_devh = dev.open(true);
    if (std::holds_alternative<libusb::Error>(maybe_devh)) {
        auto err = std::get<libusb::Error>(maybe_devh);
        switch (err.number) {
        case LIBUSB_ERROR_ACCESS:
        case LIBUSB_ERROR_NOT_SUPPORTED:
        case LIBUSB_ERROR_NOT_FOUND:
            break;
        case LIBUSB_ERROR_NO_DEVICE:
            if (retry <= 0) {
                return err.get_message();
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(500/retry));
            return maybe_get_string(dev, string, retry - 1);
        default:
            std::cerr << "Error opening device for string descriptor: " << err.get_message() << std::endl;
            break;
        }
        return err.get_message();
    }
    auto devh = std::get<libusb::Open_device>(std::move(maybe_devh));
    auto maybe_string = devh.get_string_descriptor(string);
    if (std::holds_alternative<libusb::Error>(maybe_string)) {
        auto err = std::get<libusb::Error>(maybe_string);
        //std::cerr << "Error getting string descriptor: " << err.get_message() << std::endl;
        return err.get_message();
    }
    return std::get<std::string>(std::move(maybe_string));
}

static std::variant<EndpointAndClaim, HLink_error> retry_open(libusb::Device dev) {
    for (auto i = 0u; i < 2; i++) {
        auto maybe = get_huddly_endpoint_and_claim(dev);
        if (std::holds_alternative<EndpointAndClaim>(maybe)) {
            return maybe;
        }
        auto const err = std::get<HLink_error>(std::move(maybe));
        std::cerr << "Opening device failed: " << err.message << ". Retrying." << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    return get_huddly_endpoint_and_claim(dev);
}

struct Context {
    explicit Context(Libusb ctx)
        : ctx(std::move(ctx))
        , cookie_counter(10000)
        , devices()
        , ep_claims()
    {}

    struct Device {
        libusb::Device dev;
        std::string const serial;
    };

    QueueItemPtr handle(QueueItemPtr itemptr, ListDevices const *command) {
        auto sptr = std::shared_ptr<QueueItem>(std::move(itemptr));
        auto const old_devices = std::move(devices);
        assert(devices.empty());

        auto maybe_list = ctx.get_device_list();
        if (auto err = std::get_if<libusb::Error>(&maybe_list)) {
            return std::make_unique<ReturnItem>(
                "list_devices fail",
                [num=err->number, sptr=std::move(sptr), command]() {
                    command->cb(num, std::vector<Usb_device>());
                });
        }
        auto list = std::get<0>(std::move(maybe_list));
        std::vector<Usb_device> ret_devices;
        ret_devices.reserve(list.count);
        std::string serial;
        for (auto i = 0u; i < list.count; i++) {
            auto dev = list.at(i);
            auto const descr = dev.get_device_descriptor();
            auto const location = dev.get_location();
            uint32_t found = 0;
            for (auto const &i : old_devices) {
                if (i.second.dev == dev) {
                    found = i.first;
                    dev = i.second.dev;
                    serial = i.second.serial;
                    //std::cout << "Reusing device in list" << std::endl;
                    break;
                }
            }
            if (found == 0) {
                auto const cookie = get_cookie();
                auto const serial = maybe_get_string(dev, descr.iSerialNumber);
                ret_devices.emplace_back(cookie, descr.idVendor, descr.idProduct, serial, location);
                Device idev{dev, serial};
                devices.insert(std::make_pair(cookie.cookie, idev));
            }
            else {
                ret_devices.emplace_back(Usb_cookie(found), descr.idVendor, descr.idProduct, serial, location);
                Device idev{dev, serial};
                devices.insert(std::make_pair(found, idev));
            }
        }
        return std::make_unique<ReturnItem>(
            "list_devices reply",
            [ret_devices=std::move(ret_devices), sptr=std::move(sptr)]() {
                auto & item = WorkItem::upcast(sptr);
                auto command = std::get<ListDevices>(item.command);
                //std::cout << "in handle reply callback" << std::endl;
                command.cb(0, ret_devices);
            });
    }
    QueueItemPtr handle(QueueItemPtr itemptr, OpenDevice const *command) {
        //std::cout << "handling OpenDevice" << std::endl;
        auto sptr = std::shared_ptr<QueueItem>(std::move(itemptr));
        auto maybe_device = devices.find(command->cookie.cookie);
        if (maybe_device == devices.end()) {
            return std::make_unique<ReturnItem>(
                "open_device invalid cookie",
                [sptr=std::move(sptr), command]() {
                    command->cb(-100, Usb_cookie());
                });
        }
        auto device = maybe_device->second.dev;
        auto maybe_endpoint_and_claim = retry_open(device);
        if (auto const err = std::get_if<HLink_error>(&maybe_endpoint_and_claim)) {
            return std::make_unique<ReturnItem>(
                "open_device libusb error",
                [num=err->number, sptr=std::move(sptr), command]() {
                    command->cb(num, Usb_cookie());
                });
        }
        auto cookie = get_cookie();
        ep_claims.insert({cookie.cookie, std::get<EndpointAndClaim>(std::move(maybe_endpoint_and_claim))});
        return std::make_unique<ReturnItem>(
            "open_device success",
            [sptr=std::move(sptr), cookie]() {
                auto & item = WorkItem::upcast(sptr);
                auto & command = std::get<OpenDevice>(item.command);
                command.cb(0, cookie);
            });
    }
private:
    libusb::Error handle_clear_halt_result(
        std::unordered_map<uint32_t, EndpointAndClaim>::iterator maybe_ep_claim,
        libusb::Error original,
        std::variant<std::monostate, libusb::Error> result)
    {
        if (std::holds_alternative<std::monostate>(result)) {
            return original;
        }
        auto err = std::get<libusb::Error>(std::move(result));
        std::cerr << "clear_halt gave error " << err.get_message() << std::endl;
        if (err.number == LIBUSB_ERROR_NO_DEVICE) {
            ep_claims.erase(maybe_ep_claim);
            return err;
        }
        return original;
    }
public:
    QueueItemPtr handle(QueueItemPtr itemptr, WriteDevice const *command) {
        //std::cout << "handling WriteDevice" << std::endl;
        auto sptr = std::shared_ptr<QueueItem>(std::move(itemptr));
        auto maybe_ep_claim = ep_claims.find(command->cookie.cookie);
        if (maybe_ep_claim == ep_claims.end()) {
            return std::make_unique<ReturnItem>(
                "write_device unknown cookie",
                [sptr=std::move(sptr), command]() {
                    command->cb(-100, 0);
                });
        }
        auto &ep_claim = maybe_ep_claim->second;
        auto maybe = ep_claim.ep.out(command->data.data(), command->data.size(), command->timeout_ms);
        if (std::holds_alternative<libusb::Error>(maybe)) {
            auto err = std::get<libusb::Error>(maybe);
            switch (err.number) {
            case LIBUSB_ERROR_NO_DEVICE:
                ep_claims.erase(maybe_ep_claim);
                break;
            case LIBUSB_ERROR_PIPE:
                handle_clear_halt_result(maybe_ep_claim, err, ep_claim.ep.out_clear_halt());
                break;
            }
            return std::make_unique<ReturnItem>(
                "write_device libusb error",
                [num=err.number, sptr=std::move(sptr), command]() {
                    command->cb(num, 0);
                });
        }
        auto transferred = std::get<int>(maybe);
        return std::make_unique<ReturnItem>(
            "write_device success",
            [sptr=std::move(sptr), command, transferred]() {
                command->cb(0, transferred);
            });
    }
    QueueItemPtr handle(QueueItemPtr itemptr, ReadDevice const *command) {
        //std::cout << "handling ReadDevice" << std::endl;
        auto sptr = std::shared_ptr<QueueItem>(std::move(itemptr));
        auto maybe_ep_claim = ep_claims.find(command->cookie.cookie);
        if (maybe_ep_claim == ep_claims.end()) {
            return std::make_unique<ReturnItem>(
                "read_device unknown cookie",
                [sptr=std::move(sptr), command]() {
                    command->cb(-100, {});
                });
        }
        auto &ep_claim = maybe_ep_claim->second;
        std::vector<uint8_t> buffer(command->max_size);
        auto maybe = ep_claim.ep.in(buffer.data(), buffer.size(), command->timeout_ms);
        if (std::holds_alternative<libusb::Error>(maybe)) {
            auto err = std::get<libusb::Error>(maybe);
            switch (err.number) {
            case LIBUSB_ERROR_NO_DEVICE:
                ep_claims.erase(maybe_ep_claim);
                break;
            case LIBUSB_ERROR_PIPE:
                handle_clear_halt_result(maybe_ep_claim, err, ep_claim.ep.in_clear_halt());
                break;
            }
            return std::make_unique<ReturnItem>(
                "read_device libusb error",
                [num=err.number, sptr=std::move(sptr), command]() {
                    command->cb(num, {});
                });
        }
        auto transferred = std::get<int>(maybe);
        buffer.resize(transferred);
        return std::make_unique<ReturnItem>(
            "write_device success",
            [sptr=std::move(sptr), command, buffer=std::move(buffer)]() {
                command->cb(0, buffer);
            });
    }
    QueueItemPtr handle(QueueItemPtr itemptr, CloseDevice const *command) {
        //std::cout << "handling CloseDevice" << std::endl;
        auto sptr = std::shared_ptr<QueueItem>(std::move(itemptr));
        auto maybe_ep_claim = ep_claims.find(command->cookie.cookie);
        if (maybe_ep_claim == ep_claims.end()) {
            return std::make_unique<ReturnItem>(
                "close_device unknown cookie",
                [sptr=std::move(sptr), command]() {
                    command->cb(-100);
                });
        }
        ep_claims.erase(maybe_ep_claim);
        return std::make_unique<ReturnItem>(
            "close_device success",
            [sptr=std::move(sptr), command]() {
                command->cb(0);
            });
    }

    Usb_cookie get_cookie() {
        cookie_counter += 1;
        if (cookie_counter == 0) {
            cookie_counter = 1;
        }
        return Usb_cookie(cookie_counter);
    }

    Libusb ctx;
    uint32_t cookie_counter;
    std::unordered_map<uint32_t, Device> devices;

    std::unordered_map<uint32_t, EndpointAndClaim> ep_claims;
};

int Usb_worker_arg::process() {
    int count = 0;
    for(;;) {
        auto item = from_worker->pop_nowait();
        if (!item) {
            //std::cout << "\t process() done" << std::endl;
            return count;
        }
        count += 1;
        auto &ret = ReturnItem::upcast(item);
        //std::cout << "\t process() processing return: " << ret.get_name() << std::endl;
        ret.cb();
    }
}

void usb_worker_entry(void *argp) {
    auto & arg = Usb_worker_arg::from_vptr(argp);
    auto maybe_ctx = Libusb::init();
    if (std::holds_alternative<libusb::Error>(maybe_ctx)) {
        return; // TODO: report error back to master thread
    }
    auto usbctx = std::get<Libusb>(std::move(maybe_ctx));
    Context ctx(std::move(usbctx));

    for(;;) {
        //std::cout << "Waiting for command item" << std::endl;
        auto itemptr = arg.to_worker->pop();
        auto & item = WorkItem::upcast(itemptr);
        //std::cout << "\t Got item " << item.get_name() << std::endl;
        QueueItemPtr response;
        if (auto list_devices = std::get_if<ListDevices>(&item.command)) {
            response = ctx.handle(std::move(itemptr), list_devices);
        }
        else if (auto open_device = std::get_if<OpenDevice>(&item.command)) {
            response = ctx.handle(std::move(itemptr), open_device);
        }
        else if (auto write_device = std::get_if<WriteDevice>(&item.command)) {
            response = ctx.handle(std::move(itemptr), write_device);
        }
        else if (auto read_device = std::get_if<ReadDevice>(&item.command)) {
            response = ctx.handle(std::move(itemptr), read_device);
        }
        else if (auto close_device = std::get_if<CloseDevice>(&item.command)) {
            response = ctx.handle(std::move(itemptr), close_device);
        }
        else {
            assert(false);
        }
        assert(response);
        arg.from_worker->push(std::move(response));
    }
}

void Usb_worker_arg::list_devices(std::function<void(int, std::vector<Usb_device>)> cb) {
    ListDevices list(std::move(cb));
    auto cmd = std::make_unique<WorkItem>("list_devices", std::move(list));
    to_worker->push(std::move(cmd));
}


void Usb_worker_arg::open_device(Usb_cookie cookie, std::function<void(int, Usb_cookie)> cb) {
    OpenDevice open(cookie, std::move(cb));
    auto cmd = std::make_unique<WorkItem>("open_device", std::move(open));
    to_worker->push(std::move(cmd));
}

void Usb_worker_arg::write_device(Usb_cookie cookie, std::vector<uint8_t> const data, unsigned timeout_ms, std::function<void(int, int)> cb) {
    WriteDevice write(cookie, std::move(data), timeout_ms, std::move(cb));
    auto cmd = std::make_unique<WorkItem>("write_device", std::move(write));
    to_worker->push(std::move(cmd));
}

void Usb_worker_arg::read_device(Usb_cookie cookie, size_t max_size, unsigned timeout_ms, std::function<void(int, std::vector<uint8_t>)> cb) {
    ReadDevice read(cookie, max_size, timeout_ms, std::move(cb));
    auto cmd = std::make_unique<WorkItem>("read_device", std::move(read));
    to_worker->push(std::move(cmd));
}

void Usb_worker_arg::close_device(Usb_cookie cookie, std::function<void(int)> cb) {
    CloseDevice close(cookie, std::move(cb));
    auto cmd = std::make_unique<WorkItem>("close_device", std::move(close));
    to_worker->push(std::move(cmd));
}