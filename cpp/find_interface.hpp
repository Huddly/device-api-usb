#pragma once

#include "Libusb.hpp"
#include "HLink.hpp"

struct EndpointAndClaim {
    libusb::Endpoint ep;
    libusb::Claimed_interface claim;
};

static inline std::variant<EndpointAndClaim, HLink_error> get_huddly_endpoint_and_claim(libusb::Device dev) {
    auto const maybe_devh = dev.open();
    if (std::holds_alternative<libusb::Error>(maybe_devh)) {
        return HLink_error(std::get<libusb::Error>(maybe_devh));
    }
	auto devh = std::get<libusb::Open_device>(maybe_devh);

    devh.wait_for_config();

    // Find vsc interface.
    auto maybe_config = dev.get_active_config_descriptor();
    if (std::holds_alternative<libusb::Error>(maybe_config)) {
        return HLink_error(std::get<libusb::Error>(maybe_config));
    }
    auto const config = std::get<libusb::Config_descriptor>(std::move(maybe_config));

    size_t const num_ifcs = config.desc->bNumInterfaces;
    //std::cout << "Number of interfaces: " << num_ifcs << std::endl;

    const libusb_interface_descriptor * ifc = nullptr;
    for (auto i = 0u; i < num_ifcs; i++) {
        ifc = &config.desc->interface[i].altsetting[0];
        if (ifc->bInterfaceClass == 0xff) {
            break;
        }
    }

    if (!ifc) {
        return HLink_error(HLink_error::Errors::ifc_not_found, "No vendor specific interface found");
    }

    if (ifc->bNumEndpoints < 2) {
        return HLink_error(HLink_error::Errors::endpoint_error, "Incorrect number of endpoints. At least two expected.");
    }


    auto maybe_claim = devh.claim_interface(ifc->bInterfaceNumber);

    if (std::holds_alternative<libusb::Error>(maybe_claim)) {
        return HLink_error(std::get<libusb::Error>(maybe_claim));
    }

    uint8_t vsc_ep_out_num = 0;
    uint8_t vsc_ep_in_num = 0;
    for (auto i = 0u; i < ifc->bNumEndpoints; i++) {
        uint8_t const ep_num = ifc->endpoint[i].bEndpointAddress;
        if (ep_num & 0x80) {
            vsc_ep_in_num = ep_num;
        }
        else {
            vsc_ep_out_num = ep_num;
        }
    }

    if (vsc_ep_in_num == 0) {
        return HLink_error(HLink_error::Errors::endpoint_error, "In endpoint not found");
    }
    if (vsc_ep_out_num == 0) {
        return HLink_error(HLink_error::Errors::endpoint_error, "Out endpoint not found");
    }

     /*std::cout << "Interface " << static_cast<int>(ifc->bInterfaceNumber)
            << " is VSC interface. Using this interface for HLink."
            << " ep out: " << std::hex << static_cast<int>(vsc_ep_out_num)
            << " ep in: " << static_cast<int>(vsc_ep_in_num)
            << std::dec << std::endl;*/

    return EndpointAndClaim {
        devh.get_endpoint(vsc_ep_out_num, vsc_ep_in_num),
        std::get<libusb::Claimed_interface>(std::move(maybe_claim)),
    };
}
