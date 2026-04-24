cmake_minimum_required(VERSION 3.20)
project(NodeBridge CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT WIN32)
  message(FATAL_ERROR "NodeBridge DLL targets Windows only. Build on a Windows runner (see .github/workflows/build-nodebridge.yml).")
endif()

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

include(FetchContent)

FetchContent_Declare(
  minhook
  GIT_REPOSITORY https://github.com/TsudaKageyu/minhook.git
  GIT_TAG v1.3.4
)
FetchContent_MakeAvailable(minhook)

FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
set(JSON_BuildTests OFF CACHE INTERNAL "")
FetchContent_MakeAvailable(json)

set(NB_SOURCES
  src/dllmain.cpp
  src/dwmapi_exports.cpp
  src/hook_init.cpp
  src/node_host.cpp
  src/ipc_server.cpp
  src/rpc.cpp
  src/bindings.cpp
  src/mod_loader.cpp
  src/game_thread_queue.cpp
  src/logging.cpp
  src/paths.cpp
  src/aob_scanner.cpp
  src/ue_reflection.cpp
)

add_library(dwmapi SHARED ${NB_SOURCES})

set_target_properties(dwmapi PROPERTIES
  OUTPUT_NAME "dwmapi"
  PREFIX ""
  SUFFIX ".dll"
)

target_include_directories(dwmapi PRIVATE src)
target_link_libraries(dwmapi PRIVATE minhook nlohmann_json::nlohmann_json)
target_link_libraries(dwmapi PRIVATE ws2_32 shlwapi)

if(MSVC)
  target_compile_definitions(dwmapi PRIVATE
    WIN32_LEAN_AND_MEAN
    NOMINMAX
    _CRT_SECURE_NO_WARNINGS
    UNICODE
    _UNICODE
  )
  target_compile_options(dwmapi PRIVATE /W4 /permissive- /EHsc /utf-8)
  target_link_options(dwmapi PRIVATE /DEBUG:FULL)
endif()

install(TARGETS dwmapi RUNTIME DESTINATION .)
