#pragma once
#include "identity.hpp"
#include "protocol.hpp"
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <mutex>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <memory>
#include <list>

namespace asio = boost::asio;
namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace ip = asio::ip;
using tcp = ip::tcp;
using steady_timer = asio::steady_timer;

struct Session {
    std::string id;                     // base64(ed25519_pk) = user ID
    std::array<std::byte, 32> ed25519_pk{};
    std::array<std::byte, 32> session_key{}; // x25519 shared secret
    std::string display_name;
    std::unordered_set<std::string> rooms;
    std::unique_ptr<websocket::stream<beast::tcp_stream>> ws;
    bool authenticated = false;
    bool challenge_sent = false;
    std::array<std::byte, 32> challenge{};
};

struct Room {
    std::array<std::byte, 32> id{};
    std::string name;
    bool encrypted = true;
    std::unordered_set<std::string> members; // user IDs
    std::unordered_map<std::string, std::string> roles; // user ID -> role
};

struct ServerState {
    ServerIdentity identity;
    asio::io_context io_ctx;
    std::mutex mtx;
    std::unordered_map<std::string, Session*> sessions_by_id;
    std::unordered_map<std::string, Session*> sessions_by_sock; // sock ptr as string key
    std::unordered_map<std::string, Room> rooms;
    std::list<std::string> known_peers; // "host:port"
    std::filesystem::path data_dir;

    ServerState(ServerIdentity id, std::filesystem::path dd)
        : identity(std::move(id)), data_dir(std::move(dd)) {}

    static constexpr uint16_t DEFAULT_PORT = 9733;

    auto register_session(Session& s) {
        return sessions_by_id.emplace(s.id, &s);
    }
};

// Thread-pool worker: runs io_context
inline void run_io_context(asio::io_context& ctx) {
    ctx.run();
}

// Accept loop — declared here, defined in ws.hpp after read_loop
inline void accept_loop(ServerState& state, tcp::acceptor& acceptor);

// Main server init
inline void start_server(ServerState& state, uint16_t port) {
    auto& acceptor = *new tcp::acceptor(state.io_ctx,
        tcp::endpoint(tcp::v4(), port));
    // Spawn 3 thread-pool workers
    for (int i = 0; i < 3; i++) {
        std::thread([&] { run_io_context(state.io_ctx); }).detach();
    }
    accept_loop(state, acceptor);
    state.io_ctx.run();
}
