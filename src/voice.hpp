#pragma once
#include "server.hpp"
#include "protocol.hpp"
#include <boost/asio.hpp>
#include <unordered_map>
#include <array>

// Voice: Opus frames relayed over UDP
// Server decrypts incoming frame, re-encrypts per recipient, forwards
// No STUN/TURN — server-relayed only

struct VoiceChannel {
    std::array<std::byte, 32> room_id{};
    std::unordered_map<std::string, udp::endpoint> listeners; // user ID -> UDP endpoint
};

inline auto voice_relay(ServerState& state, udp::socket& udp_sock,
                         std::span<const std::byte> data,
                         udp::endpoint const& sender) -> void {
    std::lock_guard lk(state.mtx);
    // Find which user this endpoint belongs to; relay to all others in same voice channel
    (void)udp_sock;
    (void)sender;
    // Placeholder: full implementation needs session <-> endpoint mapping
}

// UDP receive loop for voice
inline void voice_recv_loop(ServerState& state, udp::socket& udp_sock) {
    auto buf = std::make_shared<std::array<std::byte, 1500>>();
    auto sender = std::make_shared<udp::endpoint>();
    udp_sock.async_receive_from(asio::buffer(*buf), *sender,
        [&state, &udp_sock, buf, sender](beast::error_code ec, size_t len) {
            if (!ec) {
                voice_relay(state, udp_sock,
                    std::span<const std::byte>(buf->data(), len), *sender);
            }
            voice_recv_loop(state, udp_sock);
        });
}
