
#include "pch.h"
#include "HLink.hpp"
#include "find_interface.hpp"

#include "HLinkBuffer.hpp"

#include <cstring>
#include <iostream>

using namespace std;

constexpr int max_chunk_sz = 16 * 1024;

typedef Libusb::Device::Open::Claimed_interface Claim;

HLink::Subscription::Subscription(HLink &mb, std::string const subsc_cmd)
    : mb(mb)
    , subsc_cmd(subsc_cmd)
{
    mb.send("hlink-mb-subscribe", reinterpret_cast<const uint8_t *>(&subsc_cmd[0]), subsc_cmd.size());
}
HLink::Subscription::~Subscription() {
    mb.send("hlink-mb-unsubscribe", reinterpret_cast<const uint8_t *>(&subsc_cmd[0]), subsc_cmd.size());
}

struct HLink_concrete : public HLink {
    HLink_concrete(Libusb::Device::Open::Endpoint const && ep, Claim && claim)
        : ep(std::move(ep))
        , claim(std::move(claim)) {}

    HLink::Subscription subscribe(std::string const & subsc_cmd) override {
        return HLink::Subscription(*this, subsc_cmd);
    }

	std::variant<bool, HLink_error> send(std::string msg_name, const uint8_t *data, size_t sz) override {
        HLinkBuffer const hlbuf(msg_name, data, sz);
        return hl_send_buffer(hlbuf);
    }

	std::variant<Message, HLink_error> receive() override {
		std::vector<uint8_t> header(1024);
		//cout << "Reading to see if we get something back" << endl;

		{
			auto const r = ep.in(header.data(), header.size(), 10000);
			if (std::holds_alternative<Libusb_error>(r)) {
				return HLink_error(std::get<Libusb_error>(r));
			}
			auto const transferred = std::get<int>(r);
			header.resize(transferred);
		}
		//cout << "Received: " << transferred << endl;
		auto const &hdr = *reinterpret_cast<HLinkHdr *>(header.data());

		//cout << "Reading status" << endl;
		std::vector<uint8_t> payload(4096);
		assert(hdr.payload_size <= payload.size());
		{
			auto const r = ep.in(payload.data(), payload.size(), 10000);
			if (std::holds_alternative<Libusb_error>(r)) {
				return HLink_error(std::get<Libusb_error>(r));
			}
			auto const transferred = std::get<int>(r);
			payload.resize(transferred);
		}
		//cout << hdr.get_msg_name() << " payload.size()=" << payload.size() << " get_payload_size=" << hdr.payload_size << std::endl;
		assert(payload.size() == hdr.payload_size);
        return Message(hdr.get_msg_name(), std::move(payload));
    }

	std::variant<Message, HLink_error> send_receive(std::string msg_name, const uint8_t *data, size_t sz) override {
		auto const reply = msg_name + "_reply";
        auto sub = subscribe(reply);
        send(msg_name, data, sz);
        auto const ret = receive();
		if (std::holds_alternative<Message>(ret)){
			assert(std::get<Message>(ret).command == reply);
		}
		return ret;
    }
	Libusb get_usb_context() const override { return ep.get_context(); }
private:
	std::variant<bool, HLink_error> hl_send_buffer(const HLinkBuffer &hlbuf)
    {
        auto pkt = hlbuf.create_packet();

        // for (auto b : pkt) {
        //     cout << "0x" << hex << static_cast<int>(b);
        //     if (isalnum(b) || ispunct(b)) {
        //         cout << " - " << b;
        //     }
        //     cout << endl;
        // }
        // hex_dump(0, &pkt[0], pkt.size());

        int left_to_transfer = pkt.size();
		size_t offset = 0;
        while (left_to_transfer > 0) {
            auto const chunk_sz = min(left_to_transfer, max_chunk_sz);
            // cout << "left to transfer: " << left_to_transfer << ", chunk size: " << chunk_sz << endl;
            auto const r = ep.out(&pkt[offset], chunk_sz, 1000);
            if (std::holds_alternative<Libusb_error>(r)) {
				auto const err = std::get<Libusb_error>(r);
				return HLink_error(err);
            }
			auto const transferred = std::get<int>(r);
            left_to_transfer -= transferred;
			offset += transferred;
        }
		return true;
    }

    Libusb::Device::Open::Endpoint ep;
    Claim const claim;
};


static std::variant<std::unique_ptr<HLink>, HLink_error> init(Libusb::Device::Open::Endpoint const && ep, Claim && claim) {
    uint8_t data[1024];

    //cout << "Sending some crap" << endl;
	{
		auto const r = ep.out(data, 0, 1000);
		if (std::holds_alternative<Libusb_error>(r)) {
			return HLink_error(std::get<Libusb_error>(r));
		}
	}

    data[0] = 0;
	{
		auto const r = ep.out(data, 1, 1000);
		if (std::holds_alternative<Libusb_error>(r)) {
			return HLink_error(std::get<Libusb_error>(r));
		}
	}

    //cout << "Reading to see if we get a salutation" << endl;

	auto const r = ep.in(data, sizeof(data), 1000);
	if (holds_alternative<Libusb_error>(r)) {
		return HLink_error(std::get<Libusb_error>(r));
	}
	auto const transferred = std::get<int>(r);

    cout << "Salutation received: ";
    for (auto i = 0; i < transferred; i++) {
        cout << static_cast<char>(data[i]);
    }
    cout << endl;

    std::string const expected_salutation("HLink v0");
    if (memcmp(&expected_salutation[0], data, transferred) != 0) {
        cerr << "Wrong salutation received" << endl;
        return HLink_error(std::get<Libusb_error>(r));
    }
    //cout << "Salutation accepted" << endl;
    return std::make_unique<HLink_concrete>(std::move(ep), std::move(claim));
}


std::variant<std::unique_ptr<HLink>, HLink_error> HLink::open(Libusb::Device & dev)
{
    auto maybe = get_huddly_endpoint_and_claim(dev);
    if (auto const err = std::get_if<HLink_error>(&maybe)) {
        return *err;
    }
    auto dev_claim = std::get<EndpointAndClaim>(std::move(maybe));

    return init(std::move(dev_claim.ep), std::move(dev_claim.claim));
}
