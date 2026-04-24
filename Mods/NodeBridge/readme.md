### NodeBridge

Runs Node.js code inside Stalker 2 via a `dwmapi.dll`-slot proxy DLL that
spawns a bundled `node.exe` and routes per-mod JS over a named pipe. Write
your mods in JavaScript; get the full Node runtime (fs, http, npm, etc.)
without leaving the game process.

### Mod compatibility

- **UE4SS**: not compatible. Both take the `dwmapi.dll` slot.
- `.pak` mods: fully compatible — this mod doesn't touch `.cfg` / `.pak` files.

### Author a mod

Drop a `nodebridge/main.mjs` into any mod folder under `Mods/<YourMod>/`:

```js
export default async function init(bridge) {
  bridge.log("hello from node");
  // bridge.game.* is available but currently returns {unresolved: true}
  // until the v2 engine-reflection layer lands.
}
```

Run `npm run inject-nodebridge` from that mod's folder to copy it into the
game. Launch; logs appear at
`<game>/Stalker2/Binaries/Win64/NodeBridge/logs/bridge.log`.

### Proton / Wine: required launch option

Wine's default DLL override for `dwmapi` is `builtin,native` — it loads its
own copy before looking in the game folder, and your NodeBridge DLL is
ignored. In Steam → Stalker 2 → Properties → Launch Options, set:

```
WINEDLLOVERRIDES="dwmapi=n,b" %command%
```

Without this, the game will start normally but no NodeBridge logs will
appear and no JS will run.
