#pragma once
#include "../protocol.hpp"
#include "../identity.hpp"
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <deque>
#include <functional>
#include <unordered_map>
#include <array>
#include <string>

namespace asio = boost::asio;
namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace ip = asio::ip;
using tcp = ip::tcp;

struct ClientState {
    asio::io_context io_ctx;
    ServerIdentity identity;
    std::string server_id;    // server's ed25519 pk (base64)
    std::array<std::byte, 32> session_key{};
    websocket::stream<beast::tcp_stream> ws;
    bool connected = false;
    bool authenticated = false;

    // Message queue for GUI
    struct ChatEvent {
        enum Type { MSG_MSG, MSG_SYS, MSG_REACTION, MSG_ERR };
        Type type;
        std::string sender;
        std::string room;
        std::string text;
        std::array<std::byte, 32> room_id{};
        std::chrono::system_clock::time_point ts;
    };
    std::deque<ChatEvent> events;
    std::mutex event_mtx;

    std::string current_room;       // room_id key (32-char binary string)
    std::string current_room_name;  // display name
    std::vector<std::string> room_list;
    std::unordered_map<std::string, std::array<std::byte, 32>> room_ids;      // name -> room_id
    std::unordered_map<std::string, std::string> room_id_to_name;              // room_id key -> name
    std::array<std::byte, 32> challenge{};

    ClientState()
        : identity(load_or_create_identity(
              std::filesystem::path(getenv("HOME") ? getenv("HOME") : ".") / ".chatlibre")),
          ws(io_ctx) {}
};
