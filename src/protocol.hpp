#pragma once
#include "crypto.hpp"
#include <cstring>
#include <bit>
#include <spanstream>
#include <array>
#include <vector>
#include <string>
#include <string_view>
#include <optional>
#include <chrono>

// Binary protocol: all integers big-endian on wire
using Timestamp = std::chrono::system_clock::time_point;

enum class PacketType : uint8_t {
    // Client -> Server
    CS_AUTH = 0x01,
    CS_SEND_MESSAGE = 0x02,
    CS_CREATE_ROOM = 0x03,
    CS_JOIN_ROOM = 0x04,
    CS_LEAVE_ROOM = 0x05,
    CS_RELAY_REQUEST = 0x06,
    CS_PEER_DISCOVERY = 0x07,
    CS_VOICE_OFFER = 0x08,
    CS_REQUEST_KEY = 0x09,
    CS_DISCORD_IMPORT = 0x0A,
    CS_ADD_REACTION = 0x0B,
    CS_INVITE_USER = 0x0C,
    CS_SET_ROLE = 0x0D,
    CS_GET_HISTORY = 0x0E,
    CS_LIST_ROOMS = 0x0F,

    // Server -> Client
    SC_AUTH_OK = 0x81,
    SC_ROOM_LIST = 0x82,
    SC_MESSAGE = 0x83,
    SC_SYSTEM_MSG = 0x84,
    SC_RELAY_RESPONSE = 0x85,
    SC_PEER_LIST = 0x86,
    SC_VOICE_ANSWER = 0x87,
    SC_KEY_RESPONSE = 0x88,
    SC_REACTION = 0x89,
    SC_ERROR = 0xFF,
};

inline auto to_big_endian(uint32_t v) -> std::array<std::byte, 4> {
    auto be = std::bit_cast<std::array<uint8_t, 4>>(std::byteswap(v));
    return {std::byte{be[0]}, std::byte{be[1]}, std::byte{be[2]}, std::byte{be[3]}};
}

inline auto from_big_endian(std::span<const std::byte, 4> v) -> uint32_t {
    std::array<uint8_t, 4> u = {static_cast<uint8_t>(v[0]), static_cast<uint8_t>(v[1]),
                                 static_cast<uint8_t>(v[2]), static_cast<uint8_t>(v[3])};
    return std::byteswap(std::bit_cast<uint32_t>(u));
}

struct PacketHeader {
    PacketType type;
    uint32_t sender_len; // 0 for server
    uint32_t payload_len;

    // header is 1 + 4 + 4 = 9 bytes fixed
    static constexpr size_t HEADER_SIZE = 9;

    auto serialize() const -> std::array<std::byte, HEADER_SIZE> {
        std::array<std::byte, HEADER_SIZE> h{};
        h[0] = static_cast<std::byte>(type);
        auto sl = to_big_endian(sender_len);
        std::memcpy(&h[1], sl.data(), 4);
        auto pl = to_big_endian(payload_len);
        std::memcpy(&h[5], pl.data(), 4);
        return h;
    }

    static auto deserialize(std::span<const std::byte, HEADER_SIZE> h) -> PacketHeader {
        return {
            .type = static_cast<PacketType>(h[0]),
            .sender_len = from_big_endian(h.subspan<1, 4>()),
            .payload_len = from_big_endian(h.subspan<5, 4>())
        };
    }
};

struct AuthPayload {
    std::array<std::byte, 32> ed25519_pk{};
    std::array<std::byte, 64> signature{};  // sign(server_challenge || client_pk)
    std::string display_name;

    auto serialize() const -> std::vector<std::byte> {
        std::vector<std::byte> out;
        out.insert(out.end(), ed25519_pk.begin(), ed25519_pk.end());
        out.insert(out.end(), signature.begin(), signature.end());
        auto dn_len = to_big_endian(static_cast<uint32_t>(display_name.size()));
        out.insert(out.end(), dn_len.begin(), dn_len.end());
        out.insert(out.end(), (const std::byte*)display_name.data(), (const std::byte*)(display_name.data() + display_name.size()));
        return out;
    }

    static auto deserialize(std::span<const std::byte> data) -> std::optional<AuthPayload> {
        if (data.size() < 32 + 64 + 4) return std::nullopt;
        AuthPayload p;
        std::memcpy(p.ed25519_pk.data(), data.data(), 32);
        std::memcpy(p.signature.data(), data.data() + 32, 64);
        uint32_t dn_len = from_big_endian(data.subspan<32 + 64, 4>());
        if (32 + 64 + 4 + dn_len > data.size()) return std::nullopt;
        p.display_name.assign((const char*)(data.data() + 32 + 64 + 4), dn_len);
        return p;
    }
};

struct ChatMessagePayload {
    std::array<std::byte, 24> nonce{};       // secretbox nonce
    std::vector<std::byte> encrypted_body;   // ciphertext
    std::array<std::byte, 32> room_id{};
    Timestamp ts;

    auto serialize() const -> std::vector<std::byte> {
        auto ts_bytes = to_big_endian(static_cast<uint32_t>(
            std::chrono::duration_cast<std::chrono::seconds>(ts.time_since_epoch()).count()));
        std::vector<std::byte> out;
        out.insert(out.end(), nonce.begin(), nonce.end());
        auto ct_len = to_big_endian(static_cast<uint32_t>(encrypted_body.size()));
        out.insert(out.end(), ct_len.begin(), ct_len.end());
        out.insert(out.end(), encrypted_body.begin(), encrypted_body.end());
        out.insert(out.end(), room_id.begin(), room_id.end());
        out.insert(out.end(), ts_bytes.begin(), ts_bytes.end());
        return out;
    }

    static auto deserialize(std::span<const std::byte> data) -> std::optional<ChatMessagePayload> {
        if (data.size() < 24 + 4 + 32 + 4) return std::nullopt;
        ChatMessagePayload p;
        std::memcpy(p.nonce.data(), data.data(), 24);
        uint32_t ct_len = from_big_endian(std::span<const std::byte, 4>(data.subspan(24, 4)));
        if (24 + 4 + ct_len + 32 + 4 > data.size()) return std::nullopt;
        p.encrypted_body.assign(data.begin() + 24 + 4, data.begin() + 24 + 4 + ct_len);
        std::memcpy(p.room_id.data(), data.data() + 24 + 4 + ct_len, 32);
        uint32_t ts_sec = from_big_endian(std::span<const std::byte, 4>(data.subspan(24 + 4 + ct_len + 32, 4)));
        p.ts = Timestamp(std::chrono::seconds(ts_sec));
        return p;
    }
};

struct RoomInfo {
    std::array<std::byte, 32> room_id{};
    std::string name;
    bool encrypted;
    uint32_t member_count;

    auto serialize() const -> std::vector<std::byte> {
        std::vector<std::byte> out(32 + 4 + name.size() + 1 + 4);
        size_t off = 0;
        std::memcpy(&out[off], room_id.data(), 32); off += 32;
        auto nl = to_big_endian(static_cast<uint32_t>(name.size()));
        std::memcpy(&out[off], nl.data(), 4); off += 4;
        std::memcpy(&out[off], name.data(), name.size()); off += name.size();
        out[off++] = encrypted ? std::byte{1} : std::byte{0};
        auto mc = to_big_endian(member_count);
        std::memcpy(&out[off], mc.data(), 4);
        return out;
    }

    static auto deserialize(std::span<const std::byte> data) -> std::optional<RoomInfo> {
        if (data.size() < 32 + 4) return std::nullopt;
        RoomInfo r;
        size_t off = 0;
        std::memcpy(r.room_id.data(), data.data(), 32); off += 32;
        uint32_t nl = from_big_endian(data.subspan<32, 4>()); off += 4;
        if (off + nl + 1 + 4 > data.size()) return std::nullopt;
        r.name.assign((const char*)data.data() + off, nl); off += nl;
        r.encrypted = data[off++] != std::byte{0};
        r.member_count = from_big_endian(std::span<const std::byte, 4>(data.subspan(off, 4)));
        return r;
    }
};

struct PeerInfo {
    std::array<std::byte, 32> node_id{};
    std::string address; // "ip:port"
};

// Server challenge for auth
inline auto make_challenge() -> std::array<std::byte, 32> {
    std::array<std::byte, 32> c{};
    crypto::random_bytes(c);
    return c;
}

// Build a full packet (header + sender + payload)
inline auto build_packet(PacketType type, std::string_view sender_id, std::span<const std::byte> payload)
    -> std::vector<std::byte>
{
    PacketHeader hdr{
        .type = type,
        .sender_len = static_cast<uint32_t>(sender_id.size()),
        .payload_len = static_cast<uint32_t>(payload.size())
    };
    auto hdr_bytes = hdr.serialize();
    std::vector<std::byte> out;
    out.reserve(PacketHeader::HEADER_SIZE + hdr.sender_len + hdr.payload_len);
    out.insert(out.end(), hdr_bytes.begin(), hdr_bytes.end());
    out.insert(out.end(), (const std::byte*)sender_id.data(), (const std::byte*)(sender_id.data() + sender_id.size()));
    out.insert(out.end(), payload.begin(), payload.end());
    return out;
}

// Parse sender ID and payload from a received packet
struct ParsedPacket {
    PacketType type;
    std::string sender_id;
    std::span<const std::byte> payload;
};

inline auto parse_packet(std::span<const std::byte> raw) -> std::optional<ParsedPacket> {
    if (raw.size() < PacketHeader::HEADER_SIZE) return std::nullopt;
    auto hdr = PacketHeader::deserialize(raw.subspan<0, PacketHeader::HEADER_SIZE>());
    if (PacketHeader::HEADER_SIZE + hdr.sender_len + hdr.payload_len > raw.size())
        return std::nullopt;
    return ParsedPacket{
        .type = hdr.type,
        .sender_id = std::string((const char*)(raw.data() + PacketHeader::HEADER_SIZE), hdr.sender_len),
        .payload = raw.subspan(PacketHeader::HEADER_SIZE + hdr.sender_len, hdr.payload_len)
    };
}

// File storage helpers
struct FileHeader {
    std::array<std::byte, 4> magic{{std::byte{0x43}, std::byte{0x4C}, std::byte{0x46}, std::byte{0x01}}}; // "CLF\x01"
    std::array<std::byte, 32> file_id{};   // sha256 of plaintext
    std::array<std::byte, 24> nonce{};
    std::array<std::byte, 32> room_id{};
    uint32_t plaintext_len;

    static constexpr size_t HEADER_SIZE = 4 + 32 + 24 + 32 + 4;

    auto serialize() const -> std::array<std::byte, HEADER_SIZE> {
        std::array<std::byte, HEADER_SIZE> h{};
        size_t off = 0;
        std::memcpy(&h[off], magic.data(), 4); off += 4;
        std::memcpy(&h[off], file_id.data(), 32); off += 32;
        std::memcpy(&h[off], nonce.data(), 24); off += 24;
        std::memcpy(&h[off], room_id.data(), 32); off += 32;
        auto pl = to_big_endian(plaintext_len);
        std::memcpy(&h[off], pl.data(), 4);
        return h;
    }

    static auto deserialize(std::span<const std::byte, HEADER_SIZE> h) -> std::optional<FileHeader> {
        FileHeader f;
        size_t off = 0;
        if (std::memcmp(&h[off], f.magic.data(), 4) != 0) return std::nullopt; off += 4;
        std::memcpy(f.file_id.data(), &h[off], 32); off += 32;
        std::memcpy(f.nonce.data(), &h[off], 24); off += 24;
        std::memcpy(f.room_id.data(), &h[off], 32); off += 32;
        f.plaintext_len = from_big_endian(std::span<const std::byte, 4>(h.subspan(off, 4)));
        return f;
    }
};
