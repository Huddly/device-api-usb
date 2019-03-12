#include "queue_uv.hpp"
#include <uv.h>
#include <queue>
#include <cassert>

struct QueueUv : public Queue {
    QueueUv(std::function<void(void)> notify)
        : notify(std::move(notify))
        , cond{}
        , mutex{}
        , queue()
    {
        int r = uv_mutex_init(&mutex);
        assert(r == 0);
        r = uv_cond_init(&cond);
        assert(r == 0);
    }
    void push(QueueItemPtr item) override {
        uv_mutex_lock(&mutex);
        queue.push(std::move(item));
        uv_cond_signal(&cond);
        uv_mutex_unlock(&mutex);
        if (notify) {
            notify();
        }
    }

    QueueItemPtr pop() override {
        uv_mutex_lock(&mutex);
        while (queue.empty()) {
            uv_cond_wait(&cond, &mutex);
        }
        auto item = std::move(queue.front());
        queue.pop();
        uv_mutex_unlock(&mutex);
        return item;
    }

    QueueItemPtr pop_nowait() override {
        uv_mutex_lock(&mutex);
        if (queue.empty()) {
            uv_mutex_unlock(&mutex);
            return nullptr;
        }
        auto item = std::move(queue.front());
        queue.pop();
        uv_mutex_unlock(&mutex);
        return item;
    }
private:
    std::function<void(void)> const notify;
    uv_cond_t cond;
    uv_mutex_t mutex;
    std::queue<QueueItemPtr> queue;
};

QueuePtr make_uv_queue(std::function<void(void)> notify) {
    return std::make_shared<QueueUv>(std::move(notify));
}
