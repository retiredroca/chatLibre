#pragma once
#include <boost/beast.hpp>
#include <string>
#include <string_view>
#include <unordered_map>
#include <sstream>

namespace http = boost::beast::http;

// Minimal HTTP helpers for REST endpoints

inline auto make_json_response(http::response<http::string_body>& res,
                                std::string_view json, http::status status = http::status::ok) {
    res.result(status);
    res.set(http::field::content_type, "application/json");
    res.body() = json;
    res.prepare_payload();
}

inline auto make_error_response(http::response<http::string_body>& res,
                                 std::string_view msg, http::status status) {
    make_json_response(res, R"({"error":")" + std::string(msg) + "\"}", status);
}

// Parse query string from target
inline auto parse_query(std::string_view target) -> std::unordered_map<std::string, std::string> {
    std::unordered_map<std::string, std::string> params;
    auto qpos = target.find('?');
    if (qpos == std::string_view::npos) return params;
    auto qs = target.substr(qpos + 1);
    size_t start = 0;
    while (start < qs.size()) {
        auto eq = qs.find('=', start);
        auto amp = qs.find('&', start);
        if (eq == std::string_view::npos) break;
        auto key = qs.substr(start, eq - start);
        auto val_end = (amp == std::string_view::npos) ? qs.size() : amp;
        auto val = qs.substr(eq + 1, val_end - eq - 1);
        params[std::string(key)] = std::string(val);
        start = (amp == std::string_view::npos) ? qs.size() : amp + 1;
    }
    return params;
}
