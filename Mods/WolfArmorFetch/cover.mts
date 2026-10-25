/**
 * Wolf's third job, Cover Story: the ids, places and numbers its dialogs, quest nodes and cfg
 * transformers share. It is a quest of its own (`QC`): WolfArmorFetch ends once jobs 1-2 are done,
 * and End stops every node it holds, so job 3 has to live outside it to reach saves that finished
 * Falconry.
 */

export const QC = "WolfArmorFetch_Cover";

/** New spawn actors (`ESpawnType::Obj`), invented GUIDs. */
export const GUID = {
  // A fresh GUID. The old one (E07FB490...) spawned a plain Sultansk stormtrooper on 2026-10-16 and kept coming
  // back as a generic bandit after he got a prototype of his own, while a console spawn of that prototype was
  // named; saves likely remember a spawned actor by its GUID.
  hook: "EDDED100D77D49C881150A8F84F468C9",
  lead: "CB4BC704BB454BA5B5DE8000A06F8EBE",
  gunner: "DB26519F274E4FD184B4ABA7AF8EA028",
  smg: "CEF084FAAB5A44F1ADC0430423F65C25",
  guard1: "CDBB94CF85F7418E8CD7CAB24132095C",
  guard2: "091C315BFCEC4DFCA300839876B9B08A",
  /** Bagor's two lads, and the stalker they just robbed. */
  crew1: "75AFCCC56D1140D5B2284416E5771C00",
  crew2: "DA036F3F96E54D4F8F9B693741C77E54",
  corpse: "D0F5D708B1194F7EA393C8C420435808",
  /** Contextual-action spots (`ESpawnType::ContextualAction`) for Bagor and his lads. */
  caHook: "4F1C2A7E9B3D4E5FA6B7C8D9E0F1A2B3",
  caCrew1: "5A2D3B8F0C4E4F60B7C8D9EAF1A2B3C4",
  caCrew2: "6B3E4C9A1D5F4071C8D9EAFB02B3C4D5",
};
export const DEALERS = [GUID.lead, GUID.gunner, GUID.smg];
export const GUARDS = [GUID.guard1, GUID.guard2];
export const CREW = [GUID.crew1, GUID.crew2];

export const SULTAN_GUID = "C0B669CE4CC8B6F6A93774943ADDAC8B";
export const SULTAN_CHARACTER = "sultan_0";
/** Generic Ward soldier ("Unknown military"), the speaker of vanilla's Ward General_* chains. */
export const WARD_CHARACTER = "army_0";
/** Bagor's own NPC prototype and dialog speaker; his name is `sid_character_<this>` (./coverText.mts). */
export const BAGOR = "WolfArmorFetch_Bagor";

/**
 * Where they stand. The dealers are inside the building of shelter AD27BB2F45CF8138AF598FBBF63DA6A8
 * next to the Weather Station marker (59B744E544A3194779A169962ABDFBE2), on its floor (Z~724, from
 * the contextual actions placed there). The bodyguards wait on open ground west of it (Z~670). Hook
 * is ~200 m north of Sultansk, outside the hub's 80 m safe radius, at a vanilla item pack.
 */
export const POS = {
  // 30 m west of the vanilla item pack they stood at: a soap-bubble anomaly sits 3 m from it, with more
  // to the east (14-35 m); the nearest from here is 28 m south-west.
  hook: { x: 657511, y: 639026, z: 200 },
  crew1: { x: 657811, y: 638876, z: 200 },
  crew2: { x: 657261, y: 639326, z: 200 },
  // At Bagor's feet, a little above the ground: the body settles with physics.
  corpse: { x: 657661, y: 639126, z: 240 },
  // The lead stands deepest inside (nearest the shelter volume's centre, 674204/546487), the others
  // nearer the walls.
  lead: { x: 674253, y: 546241, z: 730 },
  gunner: { x: 674197, y: 546842, z: 730 },
  smg: { x: 673797, y: 546669, z: 730 },
  guard1: { x: 672856, y: 546861, z: 680 },
  guard2: { x: 672712, y: 547256, z: 680 },
};

/**
 * Something to do while they wait: a contextual-action spot at each one's Stay position, used through the
 * Stay goal's `ContextualActionRange`. Z is the ground there as the item pack 30 m east puts it (186); the
 * engine has no ground height in the cfgs, so check it in game.
 */
export const CONTEXTUAL = [
  { guid: GUID.caHook, pos: { x: 657511, y: 639026, z: 190 }, action: "CA_Quest_Smoke_Stand", yaw: 135 },
  { guid: GUID.caCrew1, pos: { x: 657811, y: 638876, z: 190 }, action: "CA_sit_ground_squat", yaw: 180 },
  { guid: GUID.caCrew2, pos: { x: 657261, y: 639326, z: 190 }, action: "CA_Quest_KPK_Stand", yaw: 0 },
];

export const DECIDER_ITEM = "Gun_Decider_AR";
export const HOOK_PDA = "WolfArmorFetch_HookPDA";
export const DEALER_PDA = "WolfArmorFetch_DealerPDA";
export const HOOK_NOTE = "WolfArmorFetch_HookNote";
export const DEALER_NOTE = "WolfArmorFetch_DealerNote";
/** Wolf's scrawled note with the sniper's name; carrying it is the "name" bonus. */
export const NAME_NOTE = "WolfArmorFetch_SniperName";
export const WARD_BADGE = "VartaDogtag";
/** RareNPCDrops' droppable copy; only ever checked behind its installed flag. */
export const RARE_WARD_BADGE = "RareNPCDrops_VartaDogtag";

/** Global variables (Int, default 0). */
export const VAR = {
  /** 1 if Skif carries a Ward badge at the meeting. */
  hasBadge: `${QC}_HasBadge`,
  /** 1 after the first slip at the meeting; the second one blows the cover. */
  strike: `${QC}_Strike`,
  /** 1 once the dealers' lead gave up the sniper's post. */
  intel: `${QC}_Intel`,
};

/**
 * The bluff rolls: a d20 each, rolled when the dealers spawn, plus Skif's bonus (rifle +1, Wolf's note +1,
 * a Ward badge +1) added when he walks in, against `dc`.
 */
export const ROLLS = [
  { name: "Hook", variable: `${QC}_Roll1`, dc: 13 },
  { name: "Fish", variable: `${QC}_Roll2`, dc: 15 },
  { name: "Fish2", variable: `${QC}_Roll3`, dc: 14 },
] as const;
export const DIE = 20;

/** In-game hours between the Falcon hand-in and Wolf offering this job. */
export const COVER_OFFER_DELAY_HOURS = 24;
/** Wolf's pay at the hand-in, whether the bluff held or it went loud. */
export const COVER_REWARD = 8000;
