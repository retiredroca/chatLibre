#pragma once
#include "server.hpp"
#include "protocol.hpp"
#include <boost/beast.hpp>

// Build SC_ROOM_LIST payload from server state
inline auto build_room_list_payload(ServerState const& state) -> std::vector<std::byte> {
    std::vector<std::byte> out;
    auto count = to_big_endian(static_cast<uint32_t>(state.rooms.size()));
    out.insert(out.end(), count.begin(), count.end());
    for (auto& [key, room] : state.rooms) {
        RoomInfo ri;
        std::memcpy(ri.room_id.data(), room.id.data(), 32);
        ri.name = room.name;
        ri.encrypted = room.encrypted;
        ri.member_count = static_cast<uint32_t>(room.members.size());
        auto ser = ri.serialize();
        out.insert(out.end(), ser.begin(), ser.end());
    }
    return out;
}

// Dispatch incoming WebSocket packets by type
inline void handle_packet(ServerState& state, Session& session, ParsedPacket const& pkt) {
    switch (pkt.type) {
    case PacketType::CS_AUTH: {
        if (!session.challenge_sent) {
            session.challenge = make_challenge();
            auto pkt = build_packet(PacketType::CS_AUTH, "",
                std::span<const std::byte>(session.challenge));
            session.ws->write(asio::buffer(pkt));
            return;
        }
        auto auth = AuthPayload::deserialize(pkt.payload);
        if (!auth) {
            auto err = build_packet(PacketType::SC_ERROR, "",
                std::span<const std::byte>((const std::byte*)"bad_auth", 8));
            session.ws->write(asio::buffer(err));
            return;
        }
        auto to_verify = std::vector<std::byte>(32 + 32);
        std::memcpy(to_verify.data(), session.challenge.data(), 32);
        std::memcpy(to_verify.data() + 32, auth->ed25519_pk.data(), 32);
        if (!crypto::verify(to_verify, auth->signature, auth->ed25519_pk)) {
            auto err = build_packet(PacketType::SC_ERROR, "",
                std::span<const std::byte>((const std::byte*)"auth_failed", 11));
            session.ws->write(asio::buffer(err));
            return;
        }
        std::lock_guard lk(state.mtx);
        session.ed25519_pk = auth->ed25519_pk;
        session.display_name = std::move(auth->display_name);
        auto their_x25519 = std::array<std::byte, 32>{};
        crypto_sign_ed25519_pk_to_curve25519(
            reinterpret_cast<unsigned char*>(their_x25519.data()),
            reinterpret_cast<unsigned char*>(session.ed25519_pk.data()));
        session.session_key = crypto::kx_server(state.identity.x25519_pk, state.identity.x25519_sk, their_x25519);
        session.id = crypto::b64_encode(session.ed25519_pk);
        state.sessions_by_id[session.id] = &session;
        session.authenticated = true;
        auto ok = build_packet(PacketType::SC_AUTH_OK, "",
            std::span<const std::byte>((const std::byte*)session.id.data(), session.id.size()));
        session.ws->write(asio::buffer(ok));
        break;
    }
    case PacketType::CS_SEND_MESSAGE: {
        if (!session.authenticated) break;
        auto msg = ChatMessagePayload::deserialize(pkt.payload);
        if (!msg) break;
        std::lock_guard lk(state.mtx);
        auto it = state.rooms.find(
            std::string((const char*)msg->room_id.data(), 32));
        if (it == state.rooms.end()) break;
        // Relay to all room members
        for (auto& member_id : it->second.members) {
            auto sit = state.sessions_by_id.find(member_id);
            if (sit == state.sessions_by_id.end() || sit->second == &session) continue;
            auto relay = build_packet(PacketType::SC_MESSAGE, session.id, pkt.payload);
            sit->second->ws->write(asio::buffer(relay));
        }
        break;
    }
    case PacketType::CS_CREATE_ROOM: {
        if (!session.authenticated) break;
        // payload = room_name (string)
        std::string room_name((const char*)pkt.payload.data(), pkt.payload.size());
        std::lock_guard lk(state.mtx);
        Room room;
        crypto::random_bytes(room.id);
        room.name = std::move(room_name);
        room.members.insert(session.id);
        auto key = std::string((const char*)room.id.data(), 32);
        state.rooms[key] = std::move(room);
        // Send updated room list to creator
        auto room_list_payload = build_room_list_payload(state);
        auto rl = build_packet(PacketType::SC_ROOM_LIST, "", room_list_payload);
        session.ws->write(asio::buffer(rl));
        break;
    }
    case PacketType::CS_JOIN_ROOM: {
        if (!session.authenticated) break;
        if (pkt.payload.size() < 32) break;
        std::array<std::byte, 32> room_id{};
        std::memcpy(room_id.data(), pkt.payload.data(), 32);
        std::lock_guard lk(state.mtx);
        auto it = state.rooms.find(std::string((const char*)room_id.data(), 32));
        if (it == state.rooms.end()) break;
        it->second.members.insert(session.id);
        session.rooms.insert(std::string((const char*)room_id.data(), 32));
        break;
    }
    case PacketType::CS_LEAVE_ROOM: {
        if (!session.authenticated) break;
        if (pkt.payload.size() < 32) break;
        std::array<std::byte, 32> room_id{};
        std::memcpy(room_id.data(), pkt.payload.data(), 32);
        std::lock_guard lk(state.mtx);
        auto it = state.rooms.find(std::string((const char*)room_id.data(), 32));
        if (it == state.rooms.end()) break;
        it->second.members.erase(session.id);
        session.rooms.erase(std::string((const char*)room_id.data(), 32));
        break;
    }
    case PacketType::CS_PEER_DISCOVERY: {
        if (!session.authenticated) break;
        // Payload is "host:port" of a known peer
        std::string peer((const char*)pkt.payload.data(), pkt.payload.size());
        std::lock_guard lk(state.mtx);
        state.known_peers.push_back(peer);
        break;
    }
    case PacketType::CS_ADD_REACTION: {
        if (!session.authenticated) break;
        // Broadcast reaction to room
        std::lock_guard lk(state.mtx);
        auto relay = build_packet(PacketType::SC_REACTION, session.id, pkt.payload);
        for (auto& [uid, s] : state.sessions_by_id) {
            if (uid != session.id && s->authenticated) {
                s->ws->write(asio::buffer(relay));
            }
        }
        break;
    }
    case PacketType::CS_LIST_ROOMS: {
        if (!session.authenticated) break;
        std::lock_guard lk(state.mtx);
        auto payload = build_room_list_payload(state);
        auto rl = build_packet(PacketType::SC_ROOM_LIST, "", payload);
        session.ws->write(asio::buffer(rl));
        break;
    }
    case PacketType::CS_GET_HISTORY: {
        break;
    }
    default:
        break;
    }
}

// Read loop for a session
inline void read_loop(ServerState& state, Session& session) {
    auto buf = std::make_shared<beast::flat_buffer>();
    session.ws->async_read(*buf, [&state, &session, buf](beast::error_code ec, size_t) {
        if (ec) {
            std::lock_guard lk(state.mtx);
            // Cleanup
            for (auto& r : session.rooms) {
                auto it = state.rooms.find(r);
                if (it != state.rooms.end()) it->second.members.erase(session.id);
            }
            state.sessions_by_id.erase(session.id);
            state.sessions_by_sock.erase(
                std::to_string(reinterpret_cast<uintptr_t>(&session)));
            delete &session;
            return;
        }
        auto data = buf->data();
        auto pkt = parse_packet(std::span<const std::byte>(
            (const std::byte*)data.data(), data.size()));
        if (pkt) handle_packet(state, session, *pkt);
        // Continue reading
        read_loop(state, session);
    });
}

// Accept loop — actual implementation using read_loop
inline void accept_loop(ServerState& state, tcp::acceptor& acceptor) {
    acceptor.async_accept([&](beast::error_code ec, tcp::socket sock) {
        if (!ec) {
            auto& session = *new Session{};
            session.ws = std::make_unique<websocket::stream<beast::tcp_stream>>(std::move(sock));
            session.ws->async_accept([&session, &state](beast::error_code ec2) {
                if (ec2) { delete &session; return; }
                session.ws->binary(true);
                auto challenge = make_challenge();
                {
                    std::lock_guard lk(state.mtx);
                    session.challenge = challenge;
                    session.challenge_sent = true;
                    state.sessions_by_sock[
                        std::to_string(reinterpret_cast<uintptr_t>(&session))] = &session;
                }
                auto challenge_bytes = build_packet(PacketType::CS_AUTH, "",
                    std::span<const std::byte>(challenge));
                session.ws->write(asio::buffer(challenge_bytes));
                read_loop(state, session);
            });
            accept_loop(state, acceptor);
        } else {
            accept_loop(state, acceptor);
        }
    });
}
