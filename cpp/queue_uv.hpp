#pragma once
#include "queue_if.hpp"
#include <functional>

QueuePtr make_uv_queue(std::function<void(void)> notify);
static inline QueuePtr make_uv_queue() {return make_uv_queue(nullptr); }
