import type { Bridge, Vector3 } from "./types.mts";
export type { Bridge, Vector3, ModInit, GameApi, ObjectRef, Unresolved } from "./types.mts";
export declare const GSC: {
    readonly uStructPropertyLink: 112;
    readonly uStructPropertiesSize: 88;
    readonly uStructSuperStruct: 64;
    readonly fFieldNamePrivate: 40;
    readonly fPropertyNextLink: 88;
    readonly fPropertyOffsetInternal: 76;
    readonly uObjectClassPtr: 16;
    /** Empirical: the cached FTransform.Translation slot lives at
     *  RelativeLocation + 0x130 within USceneComponent memory. UE renders
     *  from the cached transform, not from RelativeLocation, so a
     *  visible teleport requires writing both. */
    readonly sceneCompCachedTranslationDelta: 304;
};
export declare function parseHex(hex: string): Uint8Array;
export declare function readU32LE(b: Uint8Array, off: number): number;
export declare function readU64LE(b: Uint8Array, off: number): number;
export declare function readU64At(bridge: Bridge, addr: number): Promise<number | null>;
export declare function decodeFName(bridge: Bridge, comp: number, num: number): Promise<string>;
export declare function readVector3At(bridge: Bridge, addr: number): Promise<Vector3 | null>;
export declare function writeVector3At(bridge: Bridge, addr: number, v: Vector3): Promise<boolean>;
/** Find a property's offset within a UClass instance by name.
 *  Returns the byte offset (offset_internal) or null on miss. */
export declare function findPropertyOffset(bridge: Bridge, classPtr: number, propName: string, max?: number): Promise<number | null>;
/** Walk every property on a UClass and return {name, off}. */
export declare function listAllProperties(bridge: Bridge, classPtr: number, max?: number): Promise<Array<{
    name: string;
    off: number;
}>>;
/** Walk every property on a UClass, log {name, offset, first 4 bytes
 *  as u32 + f32}. Use to spot Health/Stamina/Ammo when you don't know
 *  the property name yet. */
export declare function dumpAllProperties(bridge: Bridge, uobjPtr: number, classPtr: number, max?: number): Promise<void>;
/** Filter `props` against name regexes, log each match's value as
 *  u32/f32/bool. Run after listAllProperties to spotlight candidates. */
export declare function highlightProperties(bridge: Bridge, uobjPtr: number, props: Array<{
    name: string;
    off: number;
}>, patterns: RegExp[], label: string): Promise<void>;
export declare const s2: {
    readU32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null>;
    readI32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null>;
    readF32(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null>;
    readF64(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null>;
    readBool(bridge: Bridge, uobjPtr: number, propOff: number): Promise<boolean | null>;
    readPtr(bridge: Bridge, uobjPtr: number, propOff: number): Promise<number | null>;
    readVector3(bridge: Bridge, uobjPtr: number, propOff: number): Promise<Vector3 | null>;
    writeU32(bridge: Bridge, uobjPtr: number, propOff: number, v: number): Promise<boolean>;
    writeF32(bridge: Bridge, uobjPtr: number, propOff: number, v: number): Promise<boolean>;
    writeVector3(bridge: Bridge, uobjPtr: number, propOff: number, v: Vector3): Promise<boolean>;
    resolve(bridge: Bridge, uobjPtr: number, classPtr: number, propName: string): Promise<{
        off: number;
        addr: number;
    } | null>;
};
/** Wait until the C++ reflection layer reports a populated GUObjectArray. */
export declare function waitForReflection(bridge: Bridge): Promise<void>;
/** Wait for the player pawn to spawn. Logs object-count progress every
 *  ~10s — count stable means the user is at the menu and hasn't loaded
 *  a save yet. Loops indefinitely (no timeout). After 30s with high
 *  object count and no pawn, dumps candidate Stalker/Character/Pawn
 *  classes from listObjects (the C++ getPlayerPawn might be missing
 *  the actual class — different cutscene character, mod variant, etc). */
export declare function waitForPlayer(bridge: Bridge): Promise<{
    index: number;
    name: string;
    className: string;
    fullPath: string;
}>;
/** Resolve everything needed to read or move the player: pawn UObject,
 *  pawn class, RootComponent, RelativeLocation address, cached
 *  FTransform.Translation address, current home position. Returns null
 *  on any resolution failure. */
export interface PlayerSession {
    pawn: {
        index: number;
        name: string;
        className: string;
        fullPath: string;
    };
    pawnPtr: number;
    pawnClassPtr: number;
    rootPtr: number;
    rootClassPtr: number;
    rootOff: number;
    relLocOff: number;
    relLocAddr: number;
    /** Address of the cached FTransform.Translation slot (UE renders
     *  from this; writing only RelativeLocation leaves the visual
     *  position stale). null if we couldn't locate it. */
    ctwTranslationAddr: number | null;
    /** The player's RelativeLocation at session-resolve time. */
    home: Vector3;
    /** CharacterMovement.Velocity address, or null if unresolved. Zero
     *  this before writing a new position to prevent the movement
     *  component re-integrating from old velocity. */
    velocityAddr: number | null;
}
export declare function getPlayerSession(bridge: Bridge, pawn: {
    index: number;
    className: string;
}): Promise<PlayerSession | null>;
/** Teleport the player to (x, y, z). Zeroes velocity, then writes both
 *  RelativeLocation and the cached FTransform.Translation. Returns
 *  true if all writes succeeded. */
export declare function teleportPlayer(bridge: Bridge, session: PlayerSession, target: Vector3): Promise<boolean>;
/** Read the player's CURRENT location (re-reads RelativeLocation and
 *  the cached FTransform.Translation; doesn't use the home cached on
 *  the session). */
export declare function readPlayerLocation(bridge: Bridge, session: PlayerSession): Promise<{
    rel: Vector3 | null;
    ctw: Vector3 | null;
}>;
