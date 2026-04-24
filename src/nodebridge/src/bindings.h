#pragma once

namespace nb::rpc { class Router; }

namespace nb::bindings {

// Registers the MVP (read-only) method set on the router:
//   game.getEngineVersion
//   game.getPlayerLocation
//   game.getObjectByName
// Also wires up event listeners for Node-side "log" events so they land in
// the DLL log file.
void install(nb::rpc::Router& router);

}  // namespace nb::bindings
