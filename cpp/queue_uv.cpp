#include "queue_uv.hpp"
#include "mutex_uv.hpp"

#include <uv.h>

#include <queue>
#include <cassert>

struct QueueUv : public Queue {
    QueueUv(std::function<void(void)> notify)
        : notify(std::move(notify))
        , cond{}
        , mutex()
        , queue()
    {
        int const r = uv_cond_init(&cond);
        assert(r == 0);
    }
    void push(QueueItemPtr item) override {
        {
            auto lock = mutex.lock();
            queue.push(std::move(item));
            uv_cond_signal(&cond);
        }
        if (notify) {
            notify();
        }
    }

    QueueItemPtr pop() override {
        auto lock = mutex.lock();
        while (queue.empty()) {
            uv_cond_wait(&cond, &mutex.mutex);
        }
        auto item = std::move(queue.front());
        queue.pop();
        return item;
    }

    QueueItemPtr pop_nowait() override {
        auto lock = mutex.lock();
        if (queue.empty()) {
            return nullptr;
        }
        auto item = std::move(queue.front());
        queue.pop();
        return item;
    }
private:
    std::function<void(void)> const notify;
    uv_cond_t cond;
    MutexUv mutex;
    std::queue<QueueItemPtr> queue;
};

QueuePtr make_uv_queue(std::function<void(void)> notify) {
    return std::make_shared<QueueUv>(std::move(notify));
}
