#pragma once
#include "app.hpp"
#include "../crypto.hpp"
#include "../protocol.hpp"
#include <boost/beast.hpp>

inline auto client_connect(ClientState& state, std::string const& host, uint16_t port) -> bool {
    try {
        tcp::resolver resolver(state.io_ctx);
        auto eps = resolver.resolve(host, std::to_string(port));
        beast::get_lowest_layer(state.ws).connect(eps);
        state.ws.handshake(host, "/");
        state.ws.binary(true);
        state.connected = true;
        return true;
    } catch (std::exception const& e) {
        (void)e;
        return false;
    }
}

// Authenticate: sign server challenge with our Ed25519 key
inline auto client_auth(ClientState& state) -> void {
    if (!state.connected || state.authenticated) return;
    AuthPayload auth;
    auth.ed25519_pk = state.identity.ed25519_pk;
    // Prepare signing input: challenge + our pk
    auto to_sign = std::vector<std::byte>(32 + 32);
    std::memcpy(reinterpret_cast<char*>(to_sign.data()), reinterpret_cast<const char*>(state.challenge.data()), 32);
    std::memcpy(reinterpret_cast<char*>(to_sign.data()) + 32, reinterpret_cast<const char*>(state.identity.ed25519_pk.data()), 32);
    auth.signature = crypto::sign(to_sign, state.identity.ed25519_sk);
    auth.display_name = state.identity.name;
    auto payload = auth.serialize();
    auto pkt = build_packet(PacketType::CS_AUTH, "", payload);
    state.ws.write(asio::buffer(pkt));
}

// Send an encrypted chat message
inline auto client_send_message(ClientState& state,
                                 std::span<const std::byte> room_id,
                                 std::string_view body) -> void {
    ChatMessagePayload msg;
    msg.nonce = crypto::gen_nonce();
    msg.room_id = {};
    std::memcpy(msg.room_id.data(), room_id.data(), 32);
    // Encrypt body with session key
    auto ct = crypto::secretbox_encrypt(
        std::span<const std::byte>((const std::byte*)body.data(), body.size()),
        msg.nonce, state.session_key);
    msg.encrypted_body = std::move(ct);
    msg.ts = std::chrono::system_clock::now();
    auto payload = msg.serialize();
    auto pkt = build_packet(PacketType::CS_SEND_MESSAGE,
        crypto::b64_encode(state.identity.ed25519_pk), payload);
    state.ws.write(asio::buffer(pkt));
}

// Create room
inline auto client_create_room(ClientState& state, std::string const& name) -> void {
    auto pkt = build_packet(PacketType::CS_CREATE_ROOM, "", std::span<const std::byte>(
        (const std::byte*)name.data(), name.size()));
    state.ws.write(asio::buffer(pkt));
}

// Join room
inline auto client_join_room(ClientState& state, std::array<std::byte, 32> const& room_id) -> void {
    auto pkt = build_packet(PacketType::CS_JOIN_ROOM, "", room_id);
    state.ws.write(asio::buffer(pkt));
}

// Request room list
inline auto client_list_rooms(ClientState& state) -> void {
    auto pkt = build_packet(PacketType::CS_LIST_ROOMS, "", {});
    state.ws.write(asio::buffer(pkt));
}

// Read loop for client
inline void client_read_loop(ClientState& state) {
    auto buf = std::make_shared<beast::flat_buffer>();
    state.ws.async_read(*buf, [&state, buf](beast::error_code ec, size_t) {
        if (ec) return;
        auto data = buf->data();
        auto pkt = parse_packet(std::span<const std::byte>(
            (const std::byte*)data.data(), data.size()));
        if (pkt) {
            std::lock_guard lk(state.event_mtx);
            switch (pkt->type) {
            case PacketType::CS_AUTH: {
                // This is a challenge from server
                if (pkt->payload.size() >= 32) {
                    std::memcpy(state.challenge.data(), pkt->payload.data(), 32);
                    client_auth(state);
                }
                break;
            }
            case PacketType::SC_AUTH_OK: {
                state.authenticated = true;
                state.server_id = std::string((const char*)pkt->payload.data(), pkt->payload.size());
                // Derive session key from server's Ed25519 pk
                {
                    auto decoded = crypto::b64_decode(state.server_id);
                    if (decoded.size() == 32) {
                        std::array<std::byte, 32> server_ed{};
                        std::memcpy(server_ed.data(), decoded.data(), 32);
                        std::array<std::byte, 32> server_x25519{};
                        crypto_sign_ed25519_pk_to_curve25519(
                            reinterpret_cast<unsigned char*>(server_x25519.data()),
                            reinterpret_cast<unsigned char*>(server_ed.data()));
                        state.session_key = crypto::kx_client(
                            state.identity.x25519_pk,
                            state.identity.x25519_sk,
                            server_x25519);
                    }
                    state.events.push_back({.type = ClientState::ChatEvent::MSG_SYS,
                        .text = "Authenticated"});
                    client_list_rooms(state);
                }
                break;
            }
            case PacketType::SC_ROOM_LIST: {
                if (pkt->payload.size() < 4) break;
                uint32_t count = from_big_endian(
                    std::span<const std::byte, 4>(pkt->payload.subspan(0, 4)));
                state.room_list.clear();
                state.room_ids.clear();
                state.room_id_to_name.clear();
                size_t off = 4;
                for (uint32_t i = 0; i < count; i++) {
                    auto remaining = pkt->payload.subspan(off);
                    auto ri = RoomInfo::deserialize(remaining);
                    if (!ri) break;
                    state.room_list.push_back(ri->name);
                    state.room_ids[ri->name] = ri->room_id;
                    std::string rkey((const char*)ri->room_id.data(), 32);
                    state.room_id_to_name[rkey] = ri->name;
                    off += (32 + 4 + ri->name.size() + 1 + 4);
                }
                break;
            }
            case PacketType::SC_MESSAGE: {
                auto msg = ChatMessagePayload::deserialize(pkt->payload);
                if (msg) {
                    auto pt = crypto::secretbox_decrypt(msg->encrypted_body, msg->nonce, state.session_key);
                    if (pt) {
                        std::string text((const char*)pt->data(), pt->size());
                        std::string room_key((const char*)msg->room_id.data(), 32);
                        state.events.push_back({.type = ClientState::ChatEvent::MSG_MSG,
                            .sender = pkt->sender_id,
                            .room = room_key,
                            .text = std::move(text),
                            .room_id = msg->room_id,
                            .ts = msg->ts});
                    }
                }
                break;
            }
            case PacketType::SC_ERROR: {
                std::string err((const char*)pkt->payload.data(), pkt->payload.size());
                state.events.push_back({.type = ClientState::ChatEvent::MSG_ERR,
                    .text = std::move(err)});
                break;
            }
            default: break;
            }
        }
        client_read_loop(state);
    });
}
