#include "../src/crypto.hpp"
#include "../src/protocol.hpp"
#include "../src/identity.hpp"
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <iostream>
#include <cstdlib>
#include <filesystem>

namespace asio = boost::asio;
namespace beast = boost::beast;
namespace websocket = beast::websocket;
using tcp = asio::ip::tcp;

auto main() -> int {
    if (!crypto::init()) { std::cerr << "FAIL: crypto init\n"; return 1; }
    auto tmp = std::filesystem::temp_directory_path() / "chatlibre_test";
    std::filesystem::remove_all(tmp);
    auto id = load_or_create_identity(tmp);

    asio::io_context ctx;
    tcp::socket sock(ctx);
    try {
        auto eps = tcp::resolver(ctx).resolve("127.0.0.1", "9733");
        asio::connect(sock, eps);
    } catch (std::exception const& e) {
        std::cerr << "FAIL: connect: " << e.what() << "\n";
        std::filesystem::remove_all(tmp);
        return 1;
    }

    websocket::stream<tcp::socket&> ws(sock);
    try {
        ws.handshake("127.0.0.1:9733", "/");
        ws.binary(true);
    } catch (std::exception const& e) {
        std::cerr << "FAIL: WebSocket handshake: " << e.what() << "\n";
        std::filesystem::remove_all(tmp);
        return 1;
    }
    std::cerr << "  OK WebSocket handshake\n";

    // 1. Read challenge
    beast::flat_buffer buf;
    boost::system::error_code ec;
    ws.read(buf, ec);
    if (ec) { std::cerr << "FAIL: read challenge: " << ec.message() << "\n"; return 1; }
    auto raw = std::span<const std::byte>(
        (const std::byte*)buf.data().data(), buf.data().size());
    auto pkt = parse_packet(raw);
    if (!pkt || pkt->type != PacketType::CS_AUTH) {
        std::cerr << "FAIL: expected CS_AUTH challenge\n"; return 1;
    }
    std::cerr << "  OK challenge\n";

    std::array<std::byte, 32> challenge{};
    std::memcpy(challenge.data(), pkt->payload.data(), std::min(pkt->payload.size(), size_t(32)));

    // 2. Sign and respond
    AuthPayload auth;
    auth.ed25519_pk = id.ed25519_pk;
    auto to_sign = std::vector<std::byte>(64);
    std::memcpy(to_sign.data(), challenge.data(), 32);
    std::memcpy(to_sign.data() + 32, id.ed25519_pk.data(), 32);
    auth.signature = crypto::sign(to_sign, id.ed25519_sk);
    auth.display_name = "test-bot";
    ws.write(asio::buffer(build_packet(PacketType::CS_AUTH, "", auth.serialize())));
    std::cerr << "  OK auth sent\n";

    // 3. Read SC_AUTH_OK
    buf.consume(buf.size());
    ws.read(buf, ec);
    if (ec) { std::cerr << "FAIL: read auth response: " << ec.message() << "\n"; return 1; }
    raw = std::span<const std::byte>(
        (const std::byte*)buf.data().data(), buf.data().size());
    pkt = parse_packet(raw);
    if (!pkt || pkt->type != PacketType::SC_AUTH_OK) {
        std::cerr << "FAIL: expected SC_AUTH_OK\n"; return 1;
    }
    auto server_id = std::string((const char*)pkt->payload.data(), pkt->payload.size());
    std::cerr << "  OK authenticated\n";

    // 4. Derive session key
    auto decoded = crypto::b64_decode(server_id);
    if (decoded.size() != 32) { std::cerr << "FAIL: bad server_id\n"; return 1; }
    std::array<std::byte, 32> server_ed{}, server_x25519{};
    std::memcpy(server_ed.data(), decoded.data(), 32);
    crypto_sign_ed25519_pk_to_curve25519(
        reinterpret_cast<unsigned char*>(server_x25519.data()),
        reinterpret_cast<unsigned char*>(server_ed.data()));
    auto session_key = crypto::kx_client(id.x25519_pk, id.x25519_sk, server_x25519);
    std::cerr << "  OK session key\n";

    // 5. Request room list (should be empty)
    ws.write(asio::buffer(build_packet(PacketType::CS_LIST_ROOMS, "", {})));
    buf.consume(buf.size());
    ws.read(buf, ec);
    if (ec) { std::cerr << "FAIL: read room list: " << ec.message() << "\n"; return 1; }
    raw = std::span<const std::byte>((const std::byte*)buf.data().data(), buf.data().size());
    pkt = parse_packet(raw);
    if (!pkt || pkt->type != PacketType::SC_ROOM_LIST) {
        std::cerr << "FAIL: expected SC_ROOM_LIST\n"; return 1;
    }
    if (pkt->payload.size() < 4) { std::cerr << "FAIL: room list too small\n"; return 1; }
    uint32_t room_count = from_big_endian(std::span<const std::byte, 4>(pkt->payload.subspan(0, 4)));
    std::cerr << "  OK room list (" << room_count << " rooms)\n";

    // 6. Create a room
    auto room_name = std::string("test-room");
    ws.write(asio::buffer(build_packet(PacketType::CS_CREATE_ROOM, "",
        std::span<const std::byte>((const std::byte*)room_name.data(), room_name.size()))));
    // Server should respond with SC_ROOM_LIST
    buf.consume(buf.size());
    ws.read(buf, ec);
    if (ec) { std::cerr << "FAIL: read room list after create: " << ec.message() << "\n"; return 1; }
    raw = std::span<const std::byte>((const std::byte*)buf.data().data(), buf.data().size());
    pkt = parse_packet(raw);
    if (!pkt || pkt->type != PacketType::SC_ROOM_LIST) {
        std::cerr << "FAIL: expected SC_ROOM_LIST after create\n"; return 1;
    }
    room_count = from_big_endian(std::span<const std::byte, 4>(pkt->payload.subspan(0, 4)));
    if (room_count != 1) { std::cerr << "FAIL: expected 1 room\n"; return 1; }
    auto ri = RoomInfo::deserialize(pkt->payload.subspan(4));
    if (!ri || ri->name != "test-room") { std::cerr << "FAIL: bad room info\n"; return 1; }
    std::cerr << "  OK room created (id=" << crypto::b64_encode(ri->room_id).substr(0, 8) << "...)\n";

    // 7. Send encrypted message to created room
    ChatMessagePayload msg;
    msg.nonce = crypto::gen_nonce();
    std::memcpy(msg.room_id.data(), ri->room_id.data(), 32);
    msg.encrypted_body = crypto::secretbox_encrypt(
        std::span<const std::byte>((const std::byte*)"hello", 5),
        msg.nonce, session_key);
    msg.ts = std::chrono::system_clock::now();
    ws.write(asio::buffer(build_packet(PacketType::CS_SEND_MESSAGE,
        crypto::b64_encode(id.ed25519_pk), msg.serialize())));
    std::cerr << "  OK encrypted message sent to room\n";

    std::filesystem::remove_all(tmp);
    ws.close(websocket::close_code::normal);
    std::cerr << "PASS\n";
    return 0;
}
