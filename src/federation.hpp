#pragma once
#include "server.hpp"
#include "protocol.hpp"
#include <boost/asio.hpp>
#include <deque>

// Peer discovery via DNS seed query or manual peer list
// Bitcoin-style: each peer knows seeds, asks them for more peers

inline auto query_seeds(ServerState& state) -> void {
    // DNS seed list — hardcoded bootstrap nodes
    static constexpr const char* SEEDS[] = {
        "seed.chatlibre.net",
        "seed2.chatlibre.net",
    };
    // In production: resolve SRV or A records.
    // For now: placeholder that adds nothing since no live infra.
    (void)state;
}

// Relay a message to a known peer over TCP
inline auto relay_to_peer(ServerState& state, std::string_view peer_addr,
                           std::span<const std::byte> data) -> void {
    auto pos = peer_addr.find(':');
    if (pos == std::string_view::npos) return;
    std::string host(peer_addr.substr(0, pos));
    uint16_t port = static_cast<uint16_t>(std::stoi(
        std::string(peer_addr.substr(pos + 1))));

    auto sock = std::make_shared<tcp::socket>(state.io_ctx);
    sock->async_connect(
        tcp::endpoint(ip::make_address(host), port),
        [sock, data](beast::error_code ec) {
            if (ec) return;
            // Write header + payload directly over TCP
            async_write(*sock, asio::buffer(data),
                [sock](beast::error_code, size_t) {});
        });
}

// Periodic peer refresh: ask known peers for their peer lists
inline auto refresh_peers(ServerState& state) -> void {
    // In production: send CS_PEER_DISCOVERY packets to known peers
    // and merge their responses into state.known_peers
    (void)state;
}
