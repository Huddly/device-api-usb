#pragma once

#include <uv.h>

#include <cassert>

class MutexUv {
public:
    MutexUv() : mutex{} {
        int r = uv_mutex_init(&mutex);
        assert(r == 0);
    }
    MutexUv(MutexUv const &) = delete;
    MutexUv &operator=(MutexUv const &) = delete;
    ~MutexUv() {
        uv_mutex_destroy(&mutex);
    }
    struct Locked {
        Locked(MutexUv &mutex) : mutex(mutex) {}
        ~Locked() { uv_mutex_unlock(&mutex.mutex); }
        Locked(Locked const &) = delete;
        Locked &operator=(Locked const &) = delete;
        MutexUv &mutex;
    };
    Locked lock() { uv_mutex_lock(&mutex); return Locked(*this); }
    uv_mutex_t mutex;
};
