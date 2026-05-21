#pragma once
#include "server.hpp"
#include <fstream>
#include <filesystem>

// File storage: encrypted files on disk at ~/.chatlibre/files/<room_id>/<file_id>.enc
// Messages: stored to flat log files per room (encrypted)
// Server stores NOTHING in memory for messages — reads from disk on request.

inline auto store_file(ServerState const& state,
                       std::array<std::byte, 32> const& room_id,
                       std::array<std::byte, 32> const& file_id,
                       std::span<const std::byte> ciphertext) -> bool {
    auto room_hex = crypto::b64_encode(room_id);
    auto file_hex = crypto::b64_encode(file_id);
    auto dir = state.data_dir / "files" / room_hex;
    std::filesystem::create_directories(dir);
    auto path = dir / (file_hex + ".enc");
    std::ofstream f(path, std::ios::binary);
    if (!f) return false;
    f.write(reinterpret_cast<const char*>(ciphertext.data()), ciphertext.size());
    return true;
}

inline auto load_file(ServerState const& state,
                      std::array<std::byte, 32> const& room_id,
                      std::array<std::byte, 32> const& file_id)
    -> std::optional<std::vector<std::byte>>
{
    auto room_hex = crypto::b64_encode(room_id);
    auto file_hex = crypto::b64_encode(file_id);
    auto path = state.data_dir / "files" / room_hex / (file_hex + ".enc");
    std::ifstream f(path, std::ios::binary | std::ios::ate);
    if (!f) return std::nullopt;
    auto size = f.tellg();
    f.seekg(0);
    std::vector<std::byte> data(size);
    f.read(reinterpret_cast<char*>(data.data()), size);
    return data;
}

// Append an encrypted message to room log
inline auto append_message_log(ServerState const& state,
                                std::array<std::byte, 32> const& room_id,
                                std::span<const std::byte> encrypted_msg) -> bool {
    auto room_hex = crypto::b64_encode(room_id);
    auto dir = state.data_dir / "logs" / room_hex;
    std::filesystem::create_directories(dir);
    auto path = dir / "messages.bin";
    std::ofstream f(path, std::ios::binary | std::ios::app);
    if (!f) return false;
    // Write length-prefixed entry
    auto len_be = to_big_endian(static_cast<uint32_t>(encrypted_msg.size()));
    f.write(reinterpret_cast<const char*>(len_be.data()), 4);
    f.write(reinterpret_cast<const char*>(encrypted_msg.data()), encrypted_msg.size());
    return true;
}

// Read room message log (up to `count` entries from end)
inline auto read_message_log(ServerState const& state,
                              std::string_view room_id_b64, size_t count = 50)
    -> std::vector<std::vector<std::byte>>
{
    auto path = state.data_dir / "logs" / room_id_b64 / "messages.bin";
    std::ifstream f(path, std::ios::binary);
    if (!f) return {};

    // Read all entries into a vector, then take last `count`
    std::vector<std::vector<std::byte>> entries;
    while (f) {
        std::array<char, 4> len_buf{};
        f.read(len_buf.data(), 4);
        if (f.gcount() < 4) break;
        std::array<std::byte, 4> len_arr{};
        std::memcpy(len_arr.data(), len_buf.data(), 4);
        uint32_t len = from_big_endian(len_arr);
        std::vector<std::byte> entry(len);
        f.read(reinterpret_cast<char*>(entry.data()), len);
        if (f.gcount() < static_cast<std::streamsize>(len)) break;
        entries.push_back(std::move(entry));
    }
    if (entries.size() > count)
        entries.erase(entries.begin(), entries.end() - count);
    return entries;
}
