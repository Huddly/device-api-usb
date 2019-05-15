#pragma once

#include "libusb.h"

#include <cassert>
#include <iostream>
#include <memory>
#include <string>
#include <variant>
#include <vector>
#include <thread>
#include <chrono>


class Libusb;

namespace libusb {
    namespace internal {
        class Inner;
        class Open_inner;
    };

    struct Error {
        explicit Error(int number) : number(number) {}
        int const number;
        std::string get_message() const {return libusb_error_name(number);}
    };

    struct Config_descriptor {
        Config_descriptor(std::shared_ptr<internal::Inner> inner, libusb_config_descriptor * desc)
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
        std::shared_ptr<internal::Inner> const inner;
    };

    struct Endpoint {
        Endpoint(std::shared_ptr<internal::Open_inner> inner, uint8_t ep) : ep_out(ep & ~0x80u), ep_in(ep | 0x80u), inner(std::move(inner)) {}

        Endpoint(std::shared_ptr<internal::Open_inner> inner, uint8_t ep_out, uint8_t ep_in) : ep_out(ep_out), ep_in(ep_in), inner(std::move(inner)) {
            assert((ep_in & 0x80u) == 0x80u);
            assert((ep_out & 0x80u) == 0x00u);
        }

        std::variant<int, Error> out(uint8_t const *data, int length, unsigned timeout) const {
            return bulk_transfer(ep_out, const_cast<uint8_t *>(data), length, timeout);
        }

        std::variant<int, Error> in(uint8_t *data, int length, unsigned timeout) const {
            return bulk_transfer(ep_in | 0x80, data, length, timeout);
        }

        std::variant<std::monostate, Error> out_clear_halt() const;
        std::variant<std::monostate, Error> in_clear_halt() const;
        uint8_t const ep_out;
        uint8_t const ep_in;
        Libusb get_context() const;
    private:
        std::variant<int, Error> bulk_transfer(uint8_t ep, unsigned char *data, int length, unsigned int timeout) const;
        std::shared_ptr<internal::Open_inner> const inner;
    };


    struct Claimed_interface {
        Claimed_interface(std::shared_ptr<internal::Open_inner> inner, int interface_number)
            : interface_number(interface_number), inner(std::move(inner)) {}

        Claimed_interface(Claimed_interface && other) noexcept
            : interface_number(other.interface_number), inner(std::move(other.inner)) {}

        Claimed_interface(Claimed_interface const &) = delete;
        Claimed_interface& operator=(Claimed_interface const &) = delete;

        ~Claimed_interface();
        int const interface_number;
    private:
        std::shared_ptr<internal::Open_inner> inner;
    };

    class Open_device {
        std::shared_ptr<internal::Open_inner> const inner;
    public:
        Open_device(std::shared_ptr<internal::Inner> ctx, libusb_device_handle * devh, bool silent);

        std::variant<Claimed_interface, Error> claim_interface(int interface_number);

        void wait_for_config();

        Endpoint get_endpoint(uint8_t endpoint) const {
            return Endpoint(inner, endpoint);
        }

        Endpoint get_endpoint(uint8_t ep_out, uint8_t ep_in) const {
            return Endpoint(inner, ep_out, ep_in);
        }

        std::variant<std::string, Error> get_string_descriptor(uint8_t index);
    };

    struct Device {
        explicit Device(std::shared_ptr<internal::Inner> inner, libusb_device * dev)
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
			// std::cout << "Libusb: libusb_unref_device " << dev << std::endl;
			libusb_unref_device(dev);
		}

        std::variant<Open_device, Error> open(bool silent=false) {
            assert(dev != nullptr);
			assert(inner != nullptr);
            libusb_device_handle *devh = nullptr;
            int const r = libusb_open(dev, &devh);
            if (r != 0) {
                Error const err(r);
                if (!silent) {
                    std::cout << "Libusb: libusb_open failed: " << err.get_message() << std::endl;
                }
                return err;

            }
            return Open_device(inner, devh, silent);
        }

        libusb_device_descriptor get_device_descriptor() const noexcept {
            assert(dev != nullptr);
            libusb_device_descriptor ret{};
            auto const r = libusb_get_device_descriptor(dev, &ret);
            static_assert(LIBUSB_API_VERSION >= 0x01000102);
            assert(r == 0); // Always succeeds, according to docs.
            return ret;
        }

        std::variant<Config_descriptor, Error> get_active_config_descriptor() const {
			assert(inner != nullptr);
            libusb_config_descriptor *config = nullptr;
            int const r = libusb_get_active_config_descriptor(dev, &config);
            if (r != 0) {
                Error err(r);
                std::cerr << "Libusb: libusb_get_active_config_descriptor failed: " << err.get_message() << std::endl;
                return std::move(err);
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
        std::shared_ptr<internal::Inner> inner;
    };

    struct Device_list {
        explicit Device_list(std::shared_ptr<internal::Inner> inner, libusb_device **devs, size_t count)
            : count(count)
            , devs(devs)
            , inner(std::move(inner))
        {
                //std::cout << "Libusb: making device list" << std::endl;
        }

        Device_list(Device_list && other) noexcept
            : count(other.count)
            , devs(other.devs)
            , inner(std::move(other.inner))
        {
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

        libusb::Device at(size_t n) {
            assert(n < count);
			assert(inner != nullptr);
            return libusb::Device(inner, devs[n]);
        }

        size_t const count;
    private:
        libusb_device ** devs;
        std::shared_ptr<internal::Inner> inner;
    };
};

struct Libusb {
    static std::variant<Libusb, libusb::Error> init();
	explicit Libusb(std::shared_ptr<libusb::internal::Inner> inner) : inner(std::move(inner)) {}
    std::variant<libusb::Device_list, libusb::Error> get_device_list();
private:
    explicit Libusb(libusb_context *ctx);
    std::shared_ptr<libusb::internal::Inner> inner;
};
