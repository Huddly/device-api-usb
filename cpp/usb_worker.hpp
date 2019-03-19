#pragma once

#include "queue_if.hpp"

#include <functional>
#include <vector>
#include <cassert>
#include <cstdint>

struct Usb_cookie {
    explicit constexpr Usb_cookie() : cookie(0) {}
    explicit constexpr Usb_cookie(uint32_t cookie) : cookie(cookie) {assert(cookie != 0);}
    operator bool() const { return cookie != 0; }
    uint32_t const cookie;
};

struct Usb_device {
    Usb_device(Usb_cookie cookie, uint16_t vid, uint16_t pid, std::string serial, std::vector<uint8_t> location)
        : cookie(cookie), vid(vid), pid(pid), serial(serial), location(location) {}
    Usb_cookie const cookie;
    uint16_t const vid;
    uint16_t const pid;
    std::string const serial;
    std::vector<uint8_t> const location;
};

struct Usb_worker_arg {
    explicit Usb_worker_arg(QueuePtr to_worker, QueuePtr from_worker)
        : to_worker(std::move(to_worker))
        , from_worker(std::move(from_worker)) {}
    static Usb_worker_arg & from_vptr(void *arg) { return *reinterpret_cast<Usb_worker_arg *>(arg); }
    static Usb_worker_arg const & from_vptr(void const *arg) { return *reinterpret_cast<Usb_worker_arg const *>(arg); }
    void * as_vptr() { return reinterpret_cast<void *>(this); }
    QueuePtr const to_worker;
    QueuePtr const from_worker;

    // These functions must always be called in the context of the main node thread/loop:
    void process(); // Call to process any pending events (make callbacks run in main context)
    void list_devices(std::function<void(int, std::vector<Usb_device>)>);
    void open_device(Usb_cookie cookie, std::function<void(int, Usb_cookie)>);
    void write_device(Usb_cookie cookie, std::vector<uint8_t> const data, unsigned timeout_ms, std::function<void(int, int)>);
    void read_device(Usb_cookie cookie, size_t max_size, unsigned timeout_ms, std::function<void(int, std::vector<uint8_t>)> cb);
    void close_device(Usb_cookie cookie, std::function<void(int)> cb);
};

void usb_worker_entry(void *arg);
