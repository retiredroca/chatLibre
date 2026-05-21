#pragma once
#include <cstdint>
#include <chrono>

// Token bucket rate limiter, no allocs
struct RateLimiter {
    uint64_t tokens;
    uint64_t max_tokens;
    unsigned refill_ms;
    uint64_t last_refill;

    RateLimiter(uint64_t max, unsigned refill_msec)
        : tokens(max), max_tokens(max), refill_ms(refill_msec),
          last_refill(now_ms()) {}

    static auto now_ms() -> uint64_t {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
    }

    auto try_consume(uint64_t cost = 1) -> bool {
        auto t = now_ms();
        auto elapsed = t - last_refill;
        if (elapsed >= refill_ms) {
            tokens = max_tokens;
            last_refill = t;
        }
        if (tokens < cost) return false;
        tokens -= cost;
        return true;
    }
};
