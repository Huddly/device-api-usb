#pragma once

#include <memory>
#include <string>

struct QueueItem {
    virtual ~QueueItem() {};
    virtual std::string get_name() const = 0;
};

typedef std::unique_ptr<QueueItem> QueueItemPtr;

struct Queue {
    virtual ~Queue() {};
    virtual void push(QueueItemPtr) = 0;
    virtual QueueItemPtr pop() = 0;
    virtual QueueItemPtr pop_nowait() = 0;
};

typedef std::shared_ptr<Queue> QueuePtr;