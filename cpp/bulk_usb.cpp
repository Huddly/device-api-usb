#include "usb_worker.hpp"
#include "queue_uv.hpp"
#define NAPI_VERSION 3
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Weffc++"
#include <napi.h>
#pragma GCC diagnostic pop
#include <uv.h>
#include <cassert>
#include <iostream>

static uv_thread_t worker;
static std::unique_ptr<Usb_worker_arg> worker_arg;

struct AsyncWrapper {
    AsyncWrapper() : refs(0), async(nullptr) {}
    void ref() {
        if (refs == 0) {
            async = new uv_async_t;
            uv_async_init(uv_default_loop(), async, process_cb);
            async->data = this;
        }
        refs += 1;
    }
    void send() {
        uv_async_send(async);
    }
private:
    static void process_cb(uv_async_t *async) {
        auto &self = *reinterpret_cast<AsyncWrapper *>(async->data);
        self.process_cb();
    }
    void process_cb() {
        // This function is always called in the context of the main node thread/loop
        if (!worker_arg) {
            return;
        }
        refs -= worker_arg->process();
        assert(refs >= 0);
        if (refs == 0 && async != nullptr) {
            uv_close(reinterpret_cast<uv_handle_t *>(async), [](uv_handle_t *handle) {
                auto async = reinterpret_cast<uv_async_t *>(handle);
                delete async;
            });
            async = nullptr;
        }
    }
    int refs;
    uv_async_t *async;
};

static AsyncWrapper async;

struct CallbackInfo {
    explicit CallbackInfo(Napi::Env const env, Napi::Function const &cb)
        : env(env)
        , cbref(Napi::Persistent(cb))
        , actx(env, "bulk_usb callbackinfo") {}
    CallbackInfo(CallbackInfo const &) = delete;
    CallbackInfo &operator=(CallbackInfo const &) = delete;
    CallbackInfo(CallbackInfo &&) = delete;
    CallbackInfo &operator=(CallbackInfo &&) = delete;

    struct Scope {
        explicit Scope(Napi::Env const &env, Napi::AsyncContext actx)
            : hscope(env)
            , actx(std::move(actx))
            , cbscope(env, this->actx)
        {}

        Scope(Scope &&o)
            : hscope(std::move(o.hscope))
            , actx(std::move(o.actx))
            , cbscope(std::move(o.cbscope))
        {}

        Scope(Scope const &) = delete;
        Scope &operator=(Scope const &) = delete;
        Scope &operator=(Scope &&) = delete;
    private:
        Napi::HandleScope hscope;
        Napi::AsyncContext actx;
        Napi::CallbackScope cbscope;
    };
    Scope scope() {
        return Scope(env, std::move(actx));
    }
    void callback(const std::initializer_list<napi_value>& args) {
        cbref.MakeCallback(env.Global(), args, actx);
    }

    ~CallbackInfo() {
        cbref.Unref();
    }
    Napi::Env const env;
    Napi::FunctionReference cbref;
    Napi::AsyncContext actx;
};

static Napi::Value listDevices(Napi::CallbackInfo const & info) {
    auto const env = info.Env();
    if (info.Length() != 1) {
        Napi::TypeError::New(env, "Expected callback argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    auto js_cb = info[0].As<Napi::Function>();
    auto cbinfo = std::make_shared<CallbackInfo>(env, js_cb);

    async.ref();
    worker_arg->list_devices([env, cbinfo=std::move(cbinfo)](int error, std::vector<Usb_device> devices){
        // std::cout << "in listDevice" << std::endl;
        auto scope = cbinfo->scope();
        if (error) {
            cbinfo->callback({Napi::Number::From(env, error)});
            return;
        }
        auto array = Napi::Array::New(env, devices.size());
        for (auto i = 0u; i < devices.size(); i++) {
            auto const & device = devices.at(i);
            auto object = Napi::Object::New(env);
            object.Set("vid", device.vid);
            object.Set("pid", device.pid);
            object.Set("serial", device.serial);
            object.Set("cookie", device.cookie.cookie);
            auto location = Napi::Array::New(env, device.location.size());
            for (auto j = 0u; j < device.location.size(); j++) {
                location.Set(j, device.location.at(j));
            }
            object.Set("location", location);
            array.Set(i, object);
        }
        cbinfo->callback({array});
        //std::cout << "in listDevices c++ callback after js callback" << std::endl;
    });
    return env.Undefined();
}

static Napi::Value openDevice(Napi::CallbackInfo const & info) {
    auto const env = info.Env();
    if (info.Length() != 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: cookie and callback").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    uint32_t const cookie_num = info[0].As<Napi::Number>();
    if (cookie_num == 0) {
        Napi::TypeError::New(env, "Cookie can not be 0").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Usb_cookie const cookie(cookie_num);
    auto js_cb = info[1].As<Napi::Function>();
    auto cbinfo = std::make_shared<CallbackInfo>(env, js_cb);
    async.ref();
    worker_arg->open_device(cookie, [env, cbinfo=std::move(cbinfo)](int error, Usb_cookie handle){
        //std::cout << "in openDevice" << std::endl;
        auto scope = cbinfo->scope();
        if (error) {
            cbinfo->callback({Napi::Number::From(env, error)});
            return;
        }
        auto object = Napi::Object::New(env);
        object.Set("handle", Napi::Number::From(env, handle.cookie));
        cbinfo->callback({object});
    });
    return env.Undefined();
}

static Napi::Value writeDevice(Napi::CallbackInfo const & info) {
    auto const env = info.Env();
    if (info.Length() != 4) {
        Napi::TypeError::New(env, "Expected 4 arguments: cookie, data, timeout_ms, and callback").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    uint32_t const cookie_num = info[0].As<Napi::Number>();
    if (cookie_num == 0) {
        Napi::TypeError::New(env, "Cookie can not be 0").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Usb_cookie const cookie(cookie_num);
    auto js_buffer = info[1].As<Napi::Uint8Array>();
    std::vector<uint8_t> const buffer(js_buffer.Data(), js_buffer.Data() + js_buffer.ByteLength());
    unsigned const timeout_ms = info[2].As<Napi::Number>();
    auto js_cb = info[3].As<Napi::Function>();
    auto cbinfo = std::make_shared<CallbackInfo>(env, js_cb);
    //std::cout << "writeDevice cookie " << cookie << std::endl;
    async.ref();
    worker_arg->write_device(cookie, buffer, timeout_ms, [env, cbinfo=std::move(cbinfo)](int error, int transferred){
        //std::cout << "in writeDevice" << std::endl;
        auto scope = cbinfo->scope();
        if (error) {
            cbinfo->callback({Napi::Number::From(env, error)});
            return;
        }
        auto object = Napi::Object::New(env);
        object.Set("transferred", Napi::Number::From(env, transferred));
        cbinfo->callback({object});
    });
    return env.Undefined();
}

static Napi::Value readDevice(Napi::CallbackInfo const & info) {
    auto const env = info.Env();
    if (info.Length() != 4) {
        Napi::TypeError::New(env, "Expected 4 arguments: cookie, bufsize, timeout_ms, and callback").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    uint32_t const cookie_num = info[0].As<Napi::Number>();
    if (cookie_num == 0) {
        Napi::TypeError::New(env, "Cookie can not be 0").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Usb_cookie const cookie(cookie_num);
    unsigned const bufsize = info[1].As<Napi::Number>();
    unsigned const timeout_ms = info[2].As<Napi::Number>();
    auto js_cb = info[3].As<Napi::Function>();
    auto cbinfo = std::make_shared<CallbackInfo>(env, js_cb);
    //std::cout << "readDevice cookie " << cookie << std::endl;
    async.ref();
    worker_arg->read_device(cookie, bufsize, timeout_ms, [env, cbinfo=std::move(cbinfo)](int error, std::vector<uint8_t> buf){
        //std::cout << "in readDevice" << std::endl;
        auto scope = cbinfo->scope();
        if (error) {
            cbinfo->callback({Napi::Number::From(env, error)});
            return;
        }
        auto object = Napi::Object::New(env);
        auto abuf = Napi::ArrayBuffer::New(env, buf.size());
        memcpy(abuf.Data(), buf.data(), buf.size());
        object.Set("data", abuf);
        cbinfo->callback({object});
    });
    return env.Undefined();
}

static Napi::Value closeDevice(Napi::CallbackInfo const & info) {
    auto const env = info.Env();
    if (info.Length() != 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: cookie, and callback").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    uint32_t const cookie_num = info[0].As<Napi::Number>();
    if (cookie_num == 0) {
        Napi::TypeError::New(env, "Cookie can not be 0").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Usb_cookie const cookie(cookie_num);
    auto js_cb = info[1].As<Napi::Function>();
    auto cbinfo = std::make_shared<CallbackInfo>(env, js_cb);
    //std::cout << "closeDevice cookie " << cookie << std::endl;
    async.ref();
    worker_arg->close_device(cookie, [env, cbinfo=std::move(cbinfo)](int error) {
        //std::cout << "in closeDevice" << std::endl;
        auto scope = cbinfo->scope();
        cbinfo->callback({Napi::Number::From(env, error)});
    });
    return env.Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    // Start our worker thread
    assert(!worker_arg);
    auto to_worker = make_uv_queue();
    auto from_worker = make_uv_queue([](){ async.send(); });
    worker_arg = std::make_unique<Usb_worker_arg>(std::move(to_worker), std::move(from_worker));
    uv_thread_create(&worker, usb_worker_entry, worker_arg->as_vptr());
    exports.Set("listDevices", Napi::Function::New(env, listDevices));
    exports.Set("openDevice", Napi::Function::New(env, openDevice));
    exports.Set("writeDevice", Napi::Function::New(env, writeDevice));
    exports.Set("readDevice", Napi::Function::New(env, readDevice));
    exports.Set("closeDevice", Napi::Function::New(env, closeDevice));
    return exports;
}

NODE_API_MODULE(bulk_usb, InitAll)
