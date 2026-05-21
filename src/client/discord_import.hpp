#pragma once
#include "../crypto.hpp"
#include "../protocol.hpp"
#include <string>
#include <vector>
#include <fstream>
#include <charconv>

// Discord JSON export format (simplified char-by-char scanner)
// Parses: messages array with id, content, timestamp, reactions, author
// Returns vector of ChatMessagePayload structs encrypted with room key

struct DiscordMessage {
    std::string id;
    std::string content;
    std::string author_id;
    std::string timestamp;
    std::vector<std::string> reactions;
};

// Minimal JSON scanner: finds strings by key
inline auto scan_json_string(std::string_view json, std::string_view key, size_t start) -> std::optional<std::string> {
    auto keypos = json.find(key, start);
    if (keypos == std::string_view::npos) return std::nullopt;
    auto colon = json.find(':', keypos + key.size());
    if (colon == std::string_view::npos) return std::nullopt;
    auto q1 = json.find('"', colon);
    if (q1 == std::string_view::npos) return std::nullopt;
    auto q2 = json.find('"', q1 + 1);
    if (q2 == std::string_view::npos) return std::nullopt;
    return std::string(json.substr(q1 + 1, q2 - q1 - 1));
}

// Scan an array of message objects
inline auto parse_discord_messages(std::string_view json) -> std::vector<DiscordMessage> {
    std::vector<DiscordMessage> msgs;
    size_t pos = 0;
    while (true) {
        auto msg_start = json.find(R"({"id":")", pos);
        if (msg_start == std::string_view::npos) break;
        pos = msg_start + 1;
        DiscordMessage msg;
        auto id = scan_json_string(json, "\"id\"", msg_start);
        if (id) msg.id = *id;
        auto content = scan_json_string(json, "\"content\"", msg_start);
        if (content) msg.content = *content;
        auto author = scan_json_string(json, "\"author\"", msg_start);
        if (author) msg.author_id = *author;
        auto ts = scan_json_string(json, "\"timestamp\"", msg_start);
        if (ts) msg.timestamp = *ts;
        msgs.push_back(std::move(msg));
    }
    return msgs;
}

// Import Discord export file -> encrypted messages
inline auto import_discord_file(std::string_view path,
                                 std::span<const std::byte, 32> room_key,
                                 std::array<std::byte, 32>& out_room_id)
    -> std::vector<std::vector<std::byte>>
{
    std::ifstream f(std::string(path).c_str());
    if (!f) return {};
    std::string json((std::istreambuf_iterator<char>(f)),
                      std::istreambuf_iterator<char>());
    auto msgs = parse_discord_messages(json);
    std::vector<std::vector<std::byte>> packets;
    for (auto& dm : msgs) {
        ChatMessagePayload p;
        p.nonce = crypto::gen_nonce();
        std::memcpy(p.room_id.data(), out_room_id.data(), 32);
        auto body = std::span<const std::byte>(
            reinterpret_cast<const std::byte*>(dm.content.data()), dm.content.size());
        p.encrypted_body = crypto::secretbox_encrypt(body, p.nonce, room_key);
        p.ts = std::chrono::system_clock::now();
        packets.push_back(p.serialize());
    }
    return packets;
}
