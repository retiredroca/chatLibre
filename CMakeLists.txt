cmake_minimum_required(VERSION 3.20)
cmake_policy(SET CMP0091 NEW)
project(chatlibre VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_compile_definitions(_WIN32_WINNT=0x0A00)

# Dependencies (via vcpkg)
find_package(boost_beast CONFIG REQUIRED)
find_package(unofficial-sodium CONFIG REQUIRED)
find_package(Opus CONFIG REQUIRED)
find_package(SDL2 CONFIG REQUIRED)
find_package(imgui CONFIG REQUIRED)

# -----------------------------------------------------------
# Common headers (included by both targets)
# -----------------------------------------------------------
set(COMMON_HEADERS
    src/crypto.hpp
    src/identity.hpp
    src/protocol.hpp
    src/ratelimit.hpp
)

# -----------------------------------------------------------
# chatlibre-server
# -----------------------------------------------------------
add_executable(chatlibre-server
    src/main.cpp
    src/server.hpp
    src/http.hpp
    src/ws.hpp
    src/federation.hpp
    src/storage.hpp
    src/voice.hpp
    ${COMMON_HEADERS}
)
target_include_directories(chatlibre-server PRIVATE src)
target_link_libraries(chatlibre-server PRIVATE
    Boost::beast
    unofficial-sodium::sodium
    Opus::opus
)

# -----------------------------------------------------------
# chatlibre-client
# -----------------------------------------------------------
add_executable(chatlibre-client
    src/client/main.cpp
    src/client/app.hpp
    src/client/gui.hpp
    src/client/network.hpp
    src/client/discord_import.hpp
    src/client/imgui_impl_sdl2.cpp
    src/client/imgui_impl_opengl3.cpp
    ${COMMON_HEADERS}
)
target_include_directories(chatlibre-client PRIVATE src)
target_link_libraries(chatlibre-client PRIVATE
    unofficial-sodium::sodium
    Opus::opus
    SDL2::SDL2
    SDL2::SDL2main
    imgui::imgui
    opengl32
)

# -----------------------------------------------------------
# protocol-test
# -----------------------------------------------------------
add_executable(protocol-test
    tests/protocol_test.cpp
    src/crypto.hpp
    src/identity.hpp
    src/protocol.hpp
)
target_include_directories(protocol-test PRIVATE src)
target_link_libraries(protocol-test PRIVATE
    Boost::beast
    unofficial-sodium::sodium
)
