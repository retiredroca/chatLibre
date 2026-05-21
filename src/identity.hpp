#pragma once
#include "crypto.hpp"
#include <filesystem>
#include <fstream>

struct ServerIdentity {
    std::array<std::byte, 64> ed25519_sk{};
    std::array<std::byte, 32> ed25519_pk{};
    std::array<std::byte, 32> x25519_sk{};
    std::array<std::byte, 32> x25519_pk{};
    std::string name;
};

inline auto load_or_create_identity(std::filesystem::path const& dir) -> ServerIdentity {
    std::filesystem::create_directories(dir);
    auto path = dir / "identity.bin";
    ServerIdentity id;
    if (std::filesystem::exists(path)) {
        std::ifstream f(path, std::ios::binary);
        f.read(reinterpret_cast<char*>(id.ed25519_sk.data()), 64);
        f.read(reinterpret_cast<char*>(id.ed25519_pk.data()), 32);
        f.read(reinterpret_cast<char*>(id.x25519_sk.data()), 32);
        f.read(reinterpret_cast<char*>(id.x25519_pk.data()), 32);
        std::getline(f, id.name);
    } else {
        auto [sk, pk] = crypto::sign_keygen();
        id.ed25519_sk = sk;
        id.ed25519_pk = pk;
        // Derive x25519 from ed25519 for key exchange
        crypto_sign_ed25519_sk_to_curve25519(
            reinterpret_cast<unsigned char*>(id.x25519_sk.data()),
            reinterpret_cast<unsigned char*>(id.ed25519_sk.data()));
        crypto_sign_ed25519_pk_to_curve25519(
            reinterpret_cast<unsigned char*>(id.x25519_pk.data()),
            reinterpret_cast<unsigned char*>(id.ed25519_pk.data()));
        id.name = "chatlibre-" + crypto::b64_encode(std::span<std::byte>(id.ed25519_pk).last<4>());
        std::ofstream f(path, std::ios::binary);
        f.write(reinterpret_cast<char*>(id.ed25519_sk.data()), 64);
        f.write(reinterpret_cast<char*>(id.ed25519_pk.data()), 32);
        f.write(reinterpret_cast<char*>(id.x25519_sk.data()), 32);
        f.write(reinterpret_cast<char*>(id.x25519_pk.data()), 32);
        f << id.name;
    }
    return id;
}
