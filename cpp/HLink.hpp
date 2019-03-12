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
	HLink_error(libusb::Error err) : error(libusb_to_err(err.number)), number(err.number), message(err.get_message()) {}

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
