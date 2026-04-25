// NodeBridge smoke test mod.
//
// All the heavy lifting (memory primitives, FProperty walker, GSC
// offsets, player session, teleport) lives in
// src/nodebridge/runtime/s2lib.mts. This file is just the
// mod-specific recipe.
//
// What it does on launch:
//   1. Wait for engine reflection + the player pawn.
//   2. Resolve the player session (pawn / RootComponent / cached
//      FTransform Translation / CharacterMovement.Velocity).
//   3. Teleport once to TARGET.
//
// Hot reload: edit + save and `[bootstrap] reload: NodeBridge/main.mts`
// fires within ~1s, then a fresh boot runs this init again.

// Imports resolve via `node_modules/@nodebridge/runtime` — same package
// name source-time and game-time, no path translation. At source-time
// the package is a symlink in this mod's node_modules pointing back at
// `src/nodebridge/runtime/`. At deploy-time inject-nodebridge sets up
// the same symlink under the deployed mod folder pointing at the
// shared `<Win64>/NodeBridge/runtime/`.
import type { ModInit, Vector3 } from "@nodebridge/runtime";
import {
  waitForReflection,
  waitForPlayer,
  getPlayerSession,
  teleportPlayer,
  readPlayerLocation,
  GSC,
  parseHex,
  readU32LE,
  readU64LE,
  readU64At,
  findPropertyOffset,
  listAllProperties,
} from "@nodebridge/runtime";

const TARGET: Vector3 = { x: 443283, y: 654576, z: -3000 };

const init: ModInit = async (bridge) => {
  bridge.log("----------------------------------------");
  bridge.log("mod boot");

  await waitForReflection(bridge);
  bridge.log("waiting for player pawn (load a save if you're at the menu)");
  const pawn = await waitForPlayer(bridge);
  bridge.log(`pawn ${JSON.stringify(pawn)}`);

  const session = await getPlayerSession(bridge, pawn);
  if (!session) {
    bridge.log.error("player session resolution failed");
    return;
  }

  const { home, relLocAddr, ctwTranslationAddr, velocityAddr } = session;
  bridge.log(
    `home=(${home.x.toFixed(1)}, ${home.y.toFixed(1)}, ${home.z.toFixed(1)})  relLoc=0x${relLocAddr.toString(16)} ctwTrans=${ctwTranslationAddr ? "0x" + ctwTranslationAddr.toString(16) : "<n/a>"} velocity=${velocityAddr ? "0x" + velocityAddr.toString(16) : "<n/a>"}`,
  );

  const ok = await teleportPlayer(bridge, session, TARGET);
  if (!ok) {
    bridge.log.error("teleport writeMemory faulted");
    return;
  }
  const { rel, ctw } = await readPlayerLocation(bridge, session);
  const fmt = (v: Vector3 | null) =>
    v ? `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})` : "<n/a>";
  bridge.log(`tp once -> (${TARGET.x}, ${TARGET.y}, ${TARGET.z}); rel=${fmt(rel)} ctw=${fmt(ctw)}`);

  // -------- WIDGET INSPECTION ---------
  // Pick the first non-CDO TextBlock and dump its class properties +
  // a hex window of its instance memory so we can see where Text lives
  // and how it's laid out (FText vs FString backing).
  bridge.log("---- widget inspection ----");
  const tbList = await bridge.game.listObjects({ className: "TextBlock", limit: 64 });
  if (!("items" in tbList)) {
    bridge.log.error("listObjects(className=TextBlock) failed");
    return;
  }
  const target = tbList.items.find((it) => !it.name.startsWith("Default__"));
  if (!target) {
    bridge.log.error("no non-CDO TextBlock found");
    return;
  }
  bridge.log(`target widget: [${target.index}] '${target.name}' (${target.className})`);
  const objR = await bridge.game.dumpObjectMemory(target.index, 0, 8);
  if (!("hex" in objR)) {
    bridge.log.error("could not read TextBlock UObject");
    return;
  }
  const widgetPtr = objR.objPtr;
  const widgetClassPtr = await readU64At(bridge, widgetPtr + GSC.uObjectClassPtr);
  if (!widgetClassPtr) {
    bridge.log.error("could not read TextBlock class_ptr");
    return;
  }
  bridge.log(`widgetPtr=0x${widgetPtr.toString(16)} classPtr=0x${widgetClassPtr.toString(16)}`);

  // Dump property names + offsets on TextBlock class (just names, no
  // value snapshot — those mostly fault for non-trivial UPROPERTY types).
  const props = await listAllProperties(bridge, widgetClassPtr, 256);
  bridge.log(`TextBlock has ${props.length} properties (after walk):`);
  for (const p of props) {
    bridge.log(`  ${p.name.padEnd(40)} @ +0x${p.off.toString(16).padStart(4, "0")}`);
  }

  // Hex dump of the widget's first 0x200 bytes — eyeball-find the FText
  // "Hello" placeholder. UE5 FText is typically 16 bytes
  // (TSharedPtr<ITextData>=8 + Flags=8). Inside ITextData, an FString
  // (24 bytes: ptr+num+max) holds the displayed wchar_t[]. We expect
  // to see the displayed text somewhere reachable from one of these
  // pointer slots.
  bridge.log("instance memory hex dump (first 0x200 bytes):");
  const dump = await bridge.game.readMemory(widgetPtr, 0x200);
  if (!("hex" in dump)) {
    bridge.log.error("readMemory dump faulted");
  } else {
    const bytes = parseHex(dump.hex);
    for (let off = 0; off < bytes.length; off += 16) {
      const row = [];
      for (let i = 0; i < 16 && off + i < bytes.length; i++) {
        row.push(bytes[off + i].toString(16).padStart(2, "0"));
      }
      // ASCII column for visible text in-place
      const ascii: string[] = [];
      for (let i = 0; i < 16 && off + i < bytes.length; i++) {
        const b = bytes[off + i];
        ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : ".");
      }
      bridge.log(`  +0x${off.toString(16).padStart(3, "0")}  ${row.join(" ")}  ${ascii.join("")}`);
    }
  }

  // Walk a few TextBlocks in parallel so we can find one whose FText
  // backs a real FString we can overwrite. UE5 FText is 16 bytes:
  // ITextData* (TSharedRef.Object) at +0x00 and FReferenceController*
  // at +0x08, then 4-byte Flags. ITextData (FTextHistory_Base or
  // similar) typically has vtable@+0x00 then an inline FString @+0x08
  // which is (TCHAR* Data, int32 Num, int32 Max).
  const textOff = await findPropertyOffset(bridge, widgetClassPtr, "Text");
  if (textOff == null) {
    bridge.log.error("Text UPROPERTY not found on TextBlock");
    return;
  }
  bridge.log(`Text property @ +0x${textOff.toString(16)}`);

  const decodeUtf16 = (bytes: Uint8Array, start: number, len: number): string => {
    let out = "";
    for (let i = 0; i < len * 2; i += 2) {
      if (start + i + 1 >= bytes.length) break;
      const cp = bytes[start + i] | (bytes[start + i + 1] << 8);
      if (cp === 0) break;
      out += cp >= 32 && cp < 0x10000 ? String.fromCharCode(cp) : "?";
    }
    return out;
  };

  // GSC FText layout (Stalker 2):
  //   FText { ITextData* TextData; FReferenceController* Controller; uint32 Flags; ... }
  //     TextData has: vtable@+0, then at +0x30 the FString.Data ptr
  //     to the DISPLAYED UTF-16 chars, and at +0x38 the (Num, Max)
  //     uint32 pair. Verified empirically:
  //       'Hint' (224 cap)                 → "Even years later, some corners…"
  //       'PressAnyButtonText' (11/16)     → "Text Block"
  //       'TextBlockDefaultValue' is at   td+0x20 (localization key)
  const TEXTDATA_FSTRING_DATA = 0x30;
  const TEXTDATA_FSTRING_NUM  = 0x38;
  const TEXTDATA_FSTRING_MAX  = 0x3c;

  bridge.log("scanning TextBlocks for visible strings (using +0x30 layout)…");
  let scanned = 0;
  for (let i = 0; i < tbList.items.length && scanned < 40; i++) {
    const tb = tbList.items[i];
    if (tb.name.startsWith("Default__")) continue;
    const tbObjR = await bridge.game.dumpObjectMemory(tb.index, 0, 8);
    if (!("hex" in tbObjR)) continue;
    const tbPtr = tbObjR.objPtr;
    const ftR = await bridge.game.readMemory(tbPtr + textOff, 16);
    if (!("hex" in ftR)) continue;
    const textDataPtr = readU64LE(parseHex(ftR.hex), 0);
    if (!textDataPtr || textDataPtr < 0x10000) continue;
    const tdR = await bridge.game.readMemory(textDataPtr + TEXTDATA_FSTRING_DATA, 16);
    if (!("hex" in tdR)) continue;
    const tb_b = parseHex(tdR.hex);
    const fsData = readU64LE(tb_b, 0);
    const fsNum = readU32LE(tb_b, 8);
    const fsMax = readU32LE(tb_b, 12);
    if (!fsData || fsNum < 1 || fsNum > 1024) continue;
    const charsR = await bridge.game.readMemory(fsData, Math.min(fsNum * 2, 200));
    if (!("hex" in charsR)) continue;
    const display = decodeUtf16(parseHex(charsR.hex), 0, fsNum - 1);  // -1 to drop null term
    bridge.log(`  [${tb.index}] '${tb.name.padEnd(28)}' (cap=${fsMax}) "${display}"`);
    scanned++;
  }

  // -------- HIJACK THE WATERMARK ----------
  // WaterMarkText shows "ykulik/WST125  " (cap=16) at the top-right
  // — always visible, all 9 widgets share the same FString backing,
  // so we only need to write once and the whole HUD updates.
  const watermark = tbList.items.find((it) => it.name === "WaterMarkText" && !it.name.startsWith("Default__"));
  if (watermark) {
    const wmObjR = await bridge.game.dumpObjectMemory(watermark.index, 0, 8);
    if ("hex" in wmObjR) {
      const wmPtr = wmObjR.objPtr;
      const wmFtR = await bridge.game.readMemory(wmPtr + textOff, 16);
      if ("hex" in wmFtR) {
        const wmTextDataPtr = readU64LE(parseHex(wmFtR.hex), 0);
        const fstrR = await bridge.game.readMemory(wmTextDataPtr + 0x30, 16);
        if ("hex" in fstrR) {
          const fb = parseHex(fstrR.hex);
          const fsData = readU64LE(fb, 0);
          const fsMax = readU32LE(fb, 12);
          bridge.log(`watermark FString: data=0x${fsData.toString(16)} max=${fsMax}`);

          const message = "Hello NodeJS!".slice(0, fsMax - 1).padEnd(fsMax - 1, " ");
          const targetNum = message.length + 1;  // chars + null

          // Build UTF-16 LE payload + null terminator + zero-fill
          // remaining capacity so any leftover bytes from the old
          // string don't tail past our null.
          const buf = new ArrayBuffer(fsMax * 2);
          const dv = new DataView(buf);
          for (let i = 0; i < message.length; i++) {
            dv.setUint16(i * 2, message.charCodeAt(i), true);
          }
          // bytes after message stay zero (terminator + zero-fill).
          const u8 = new Uint8Array(buf);
          let hex = "";
          for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, "0");

          // Loop every 500ms so even if UE re-derives the watermark
          // string from a delegate, our text wins back next tick.
          // Detached: we don't await, so init can return.
          const writeOnce = async () => {
            await bridge.game.writeMemory(fsData, hex);
            // Update Num (chars including null term)
            const numBuf = new ArrayBuffer(4);
            new DataView(numBuf).setUint32(0, targetNum, true);
            let numHex = "";
            const nb = new Uint8Array(numBuf);
            for (let i = 0; i < 4; i++) numHex += nb[i].toString(16).padStart(2, "0");
            await bridge.game.writeMemory(wmTextDataPtr + 0x38, numHex);
          };

          // Confirm one cycle: write, read back, log.
          await writeOnce();
          const verifyR = await bridge.game.readMemory(fsData, fsMax * 2);
          if ("hex" in verifyR) {
            const vbytes = parseHex(verifyR.hex);
            const verifyStr = decodeUtf16(vbytes, 0, fsMax);
            bridge.log(`wrote watermark; readback: "${verifyStr}"  (target="${message}")`);
          }

          // Persist: 500ms loop. Each tick rewrites the chars so the
          // hijack survives any engine refresh of the watermark.
          setInterval(() => writeOnce().catch((e) => bridge.log.error(`watermark write fail: ${e}`)), 500);
          bridge.log("watermark refresh loop started (500ms)");
        }
      }
    }
  } else {
    bridge.log("no WaterMarkText instance — can't hijack");
  }

  // Old verbose dump retained for reference (only first 1 entry now).
  for (let i = 0; i < 0; i++) {
    const tb = tbList.items[i];
    if (tb.name.startsWith("Default__")) continue;
    const tbObjR = await bridge.game.dumpObjectMemory(tb.index, 0, 8);
    if (!("hex" in tbObjR)) continue;
    const tbPtr = tbObjR.objPtr;
    const ftR = await bridge.game.readMemory(tbPtr + textOff, 16);
    if (!("hex" in ftR)) continue;
    const ftBytes = parseHex(ftR.hex);
    const textDataPtr = readU64LE(ftBytes, 0);
    if (!textDataPtr || textDataPtr < 0x10000) continue;
    bridge.log(`[${tb.index}] '${tb.name}' td=0x${textDataPtr.toString(16)} — hex dump:`);
    const tdR = await bridge.game.readMemory(textDataPtr, 0x80);
    if (!("hex" in tdR)) continue;
    const tdBytes = parseHex(tdR.hex);
    for (let off = 0; off < tdBytes.length; off += 16) {
      const row = [];
      for (let j = 0; j < 16 && off + j < tdBytes.length; j++) {
        row.push(tdBytes[off + j].toString(16).padStart(2, "0"));
      }
      const ascii: string[] = [];
      for (let j = 0; j < 16 && off + j < tdBytes.length; j++) {
        const b = tdBytes[off + j];
        ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : ".");
      }
      bridge.log(`   td+0x${off.toString(16).padStart(2, "0")}  ${row.join(" ")}  ${ascii.join("")}`);
    }
    // Also try every 8-byte pointer slot in td: chase it, see if it
    // points at a UTF-16 string.
    bridge.log(`  candidate pointer chases:`);
    for (let off = 0; off + 8 <= tdBytes.length; off += 8) {
      const ptr = readU64LE(tdBytes, off);
      if (!ptr || ptr < 0x10000) continue;
      // Read 64 bytes; interpret as UTF-16. If the first chars are
      // sane ASCII range and there's a null terminator, log it.
      const cR = await bridge.game.readMemory(ptr, 64);
      if (!("hex" in cR)) continue;
      const cBytes = parseHex(cR.hex);
      const s = decodeUtf16(cBytes, 0, 30);
      if (s.length === 0) continue;
      const printable = s.replace(/[^\x20-\x7e]/g, ".");
      bridge.log(`    td+0x${off.toString(16).padStart(2, "0")} → 0x${ptr.toString(16)}: utf16 "${printable}"`);
    }
  }

  bridge.log("---- end widget inspection ----");
};

export default init;
