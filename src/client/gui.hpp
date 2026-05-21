#pragma once
#include "app.hpp"
#include "network.hpp"
#include "../protocol.hpp"
#include "imgui.h"
#include "imgui_impl_sdl2.h"
#include "imgui_impl_opengl3.h"
#include <SDL.h>
#include <SDL_opengl.h>
#include <vector>
#include <cstring>

struct GuiState {
    SDL_Window* window = nullptr;
    SDL_GLContext gl_ctx = nullptr;
    char host[256] = "localhost";
    int port = 9733;
    char msg_buf[4096] = {};
    char room_name[128] = {};
    bool show_room_list = true;
    bool connected = false;

    auto init() -> bool {
        if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER) < 0) return false;
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, 0);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
        SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
        SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
        window = SDL_CreateWindow("chatLibre", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                                  1280, 720, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE);
        if (!window) return false;
        gl_ctx = SDL_GL_CreateContext(window);
        SDL_GL_MakeCurrent(window, gl_ctx);
        SDL_GL_SetSwapInterval(1);
        ImGui::CreateContext();
        ImGui_ImplSDL2_InitForOpenGL(window, gl_ctx);
        ImGui_ImplOpenGL3_Init("#version 330");
        return true;
    }

    auto shutdown() -> void {
        ImGui_ImplOpenGL3_Shutdown();
        ImGui_ImplSDL2_Shutdown();
        ImGui::DestroyContext();
        if (gl_ctx) SDL_GL_DeleteContext(gl_ctx);
        if (window) SDL_DestroyWindow(window);
        SDL_Quit();
    }
};

inline auto render_gui(ClientState& state, GuiState& gui) -> void {
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL2_NewFrame();
    ImGui::NewFrame();

    // Menu bar
    if (ImGui::BeginMainMenuBar()) {
        if (ImGui::BeginMenu("File")) {
            if (ImGui::MenuItem("Quit")) gui.connected = false;
            ImGui::EndMenu();
        }
        ImGui::EndMainMenuBar();
    }

    // Left panel: room list + connect
    ImGui::Begin("Rooms", &gui.show_room_list);
    if (!state.authenticated) {
        ImGui::InputText("Host", gui.host, sizeof(gui.host));
        ImGui::InputInt("Port", &gui.port);
        if (ImGui::Button("Connect")) {
            gui.connected = true;
        }
    } else {
        ImGui::Text("Server: %s", state.server_id.c_str());
        ImGui::Separator();
        ImGui::InputText("New room", gui.room_name, sizeof(gui.room_name));
        if (ImGui::Button("Create") && gui.room_name[0]) {
            client_create_room(state, gui.room_name);
            gui.room_name[0] = '\0';
        }
        ImGui::Separator();
        for (auto& room : state.room_list) {
            auto it = state.room_ids.find(room);
            std::string rkey = (it != state.room_ids.end())
                ? std::string((const char*)it->second.data(), 32) : "";
            bool selected = !rkey.empty() && rkey == state.current_room;
            if (ImGui::Selectable(room.c_str(), selected)) {
                state.current_room = rkey;
                state.current_room_name = room;
            }
        }
    }
    ImGui::End();

    // Main chat area
    ImGui::Begin("Chat", nullptr, ImGuiWindowFlags_NoCollapse);
    if (!state.current_room.empty()) {
        std::lock_guard lk(state.event_mtx);
        for (auto& ev : state.events) {
            if (ev.type == ClientState::ChatEvent::MSG_MSG) {
                bool matches = std::string((const char*)ev.room_id.data(), 32) == state.current_room;
                if (!matches) continue;
            }
            switch (ev.type) {
            case ClientState::ChatEvent::MSG_MSG:
                ImGui::Text("<%s> %s", ev.sender.c_str(), ev.text.c_str());
                break;
            case ClientState::ChatEvent::MSG_SYS:
                ImGui::Text("[%s]", ev.text.c_str());
                break;
            case ClientState::ChatEvent::MSG_REACTION:
                ImGui::Text("* %s reacted", ev.sender.c_str());
                break;
            case ClientState::ChatEvent::MSG_ERR:
                ImGui::TextColored(ImVec4(1,0,0,1), "ERROR: %s", ev.text.c_str());
                break;
            }
        }
    }
    ImGui::End();

    // Input area
    ImGui::Begin("Input", nullptr, ImGuiWindowFlags_NoCollapse);
    ImGui::InputTextMultiline("##msg", gui.msg_buf, sizeof(gui.msg_buf),
                               ImVec2(-1, ImGui::GetTextLineHeight() * 4));
    if (ImGui::Button("Send") && gui.msg_buf[0] && !state.current_room.empty()) {
        std::array<std::byte, 32> room_id{};
        std::memcpy(room_id.data(), state.current_room.data(), 32);
        client_send_message(state, room_id,
            std::string_view(gui.msg_buf));
        gui.msg_buf[0] = '\0';
    }
    ImGui::SameLine();
    if (ImGui::Button("Disconnect")) {
        gui.connected = false;
    }
    ImGui::End();

    ImGui::Render();
    glViewport(0, 0, (int)ImGui::GetIO().DisplaySize.x, (int)ImGui::GetIO().DisplaySize.y);
    glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    SDL_GL_SwapWindow(gui.window);
}
