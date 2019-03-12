#pragma once
#include "Libusb.hpp"

#include <memory>
#include <string>
#include <vector>
#include <cstdint>
#include <variant>

struct HLink_error {
	enum class Errors {
		timeout, access, unknown_libusb_error, no_device, device_not_found,
        ifc_not_found, endpoint_error
	};
    HLink_error(Errors error, std::string message) : error(error), number(0), message(std::move(message)) {}
	HLink_error(Libusb_error err) : error(libusb_to_err(err.number)), number(err.number), message(err.get_message()) {}

	Errors const error;
	int const number;
	std::string const message;
private:
	constexpr Errors libusb_to_err(int e){
		switch (e) {
		case LIBUSB_ERROR_TIMEOUT: return Errors::timeout;
		case LIBUSB_ERROR_ACCESS: return Errors::access;
		case LIBUSB_ERROR_NO_DEVICE: return Errors::no_device;
		default: return Errors::unknown_libusb_error;
		}
	}
};

struct HLink {
    static std::variant<std::unique_ptr<HLink>, HLink_error> open(Libusb::Device & dev);
    struct Subscription {
        Subscription(HLink &mb, std::string const subsc_cmd);
        ~Subscription();
        HLink & mb;
        std::string const subsc_cmd;
    };
    virtual Subscription subscribe(std::string const & subsc_cmd) = 0;
    virtual std::variant<bool, HLink_error> send(std::string msg_name, const uint8_t *data, size_t sz) = 0;
    struct Message {
        Message(std::string && command, std::vector<uint8_t> && data) : command(command), data(data) {}
        std::string const command;
        std::vector<uint8_t> const data;
    };
    virtual std::variant<Message, HLink_error> receive() = 0;
    virtual std::variant<Message, HLink_error> send_receive(std::string msg_name, const uint8_t *data, size_t sz) = 0;
	virtual Libusb get_usb_context() const = 0;
	virtual ~HLink() = default;
};
