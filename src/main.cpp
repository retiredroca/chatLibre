#include "server.hpp"
#include "ws.hpp"
#include "crypto.hpp"
#include "identity.hpp"
#include <iostream>
#include <cstring>
#include <string_view>

struct CliArgs {
    std::filesystem::path data_dir = std::filesystem::path(getenv("HOME") ? getenv("HOME") : ".") / ".chatlibre";
    uint16_t port = 9733;
    bool daemon = false;
};

static auto parse_cli(int argc, char** argv) -> CliArgs {
    CliArgs args;
    for (int i = 1; i < argc; i++) {
        std::string_view arg(argv[i]);
        if (arg == "--data-dir" && i + 1 < argc) args.data_dir = argv[++i];
        else if (arg == "--port" && i + 1 < argc) args.port = static_cast<uint16_t>(std::stoi(argv[++i]));
        else if (arg == "--daemon") args.daemon = true;
    }
    return args;
}

auto main(int argc, char** argv) -> int {
    if (!crypto::init()) {
        std::cerr << "FATAL: libsodium init failed\n";
        return 1;
    }

    auto cli = parse_cli(argc, argv);

    auto identity = load_or_create_identity(cli.data_dir);
    std::cout << "Server identity: " << identity.name << "\n";
    std::cout << "  ed25519 pk: " << crypto::b64_encode(identity.ed25519_pk).substr(0, 16) << "...\n";

    ServerState state(std::move(identity), cli.data_dir);

    std::cout << "Starting server on port " << cli.port << "...\n";
    start_server(state, cli.port);

    return 0;
}
