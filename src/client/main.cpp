#include "app.hpp"
#include "gui.hpp"
#include "network.hpp"
#include "../crypto.hpp"
#include <SDL.h>
#include <thread>

auto main(int, char**) -> int {
    if (!crypto::init()) return 1;

    ClientState state;
    GuiState gui;
    if (!gui.init()) return 1;

    // Background network thread
    std::thread net_thread([&] {
        while (gui.connected) {
            if (state.connected && !state.authenticated) {
                state.io_ctx.poll_one();
            } else if (state.authenticated) {
                state.io_ctx.poll_one();
            } else {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
            }
        }
    });

    // Main loop
    bool running = true;
    while (running) {
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            ImGui_ImplSDL2_ProcessEvent(&ev);
            if (ev.type == SDL_QUIT) running = false;
        }
        if (!running) break;

        // Connect on demand
        if (gui.connected && !state.connected) {
            if (client_connect(state, gui.host, gui.port)) {
                state.connected = true;
                client_read_loop(state);
            } else {
                gui.connected = false;
            }
        }

        // Render
        render_gui(state, gui);

        // Check disconnect
        if (!gui.connected) {
            running = false;
        }
    }

    gui.shutdown();
    if (net_thread.joinable()) net_thread.join();
    return 0;
}
