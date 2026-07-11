import React, { useState, useEffect, useRef, useCallback } from "react";

// ---------- palette ----------
const C = {
  bg: "#141517",
  panel: "#1D1F22",
  panelUp: "#26282C",
  line: "#33363B",
  text: "#E9E7E2",
  dim: "#8F9298",
  faint: "#5C5F65",
  orange: "#FF4D00",
  green: "#3ED47A",
  amber: "#E8B23A",
  red: "#FF6B5E",
  blue: "#5AC8FA",
};

const CONF = {
  solid: { label: "SOLID", color: C.green, tip: "Verified against the manufacturer's MIDI reference" },
  likely: { label: "LIKELY", color: C.amber, tip: "Consistent with the published chart — spot-check on the device" },
  verify: { label: "VERIFY", color: C.red, tip: "Placeholder — confirm in the device manual" },
  custom: { label: "USER-SET", color: C.blue, tip: "You define this on the device itself" },
};

const EXPR = {
  yes:    { label: "YES",    color: C.green },
  likely: { label: "LIKELY", color: C.amber },
  verify: { label: "TEST",   color: C.amber },
  map:    { label: "VIA CC", color: C.blue },
  no:     { label: "NO",     color: C.faint },
};

const IS_TOUCH = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer: coarse)").matches
  : false;

const storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    if (v === null) throw new Error("not found");
    return { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

const uid = () => Math.random().toString(36).slice(2, 9);

const m = (control, cc, type, conf, note = "") => ({
  id: uid(), control, cc: String(cc), type, conf, note,
});

// ---------- device library — CCs verified July 2026 against manufacturer MIDI references ----------
const DEVICE_LIBRARY = [
  {
    libKey: "opxy", chans: [15], route: "bus", blurb: "TE groovebox — channel-per-track",
    diagSub: { rk: "TRS A→B dongle · ch 15 (active trk)", thru: "DIN→TRS Type B · ch 15 (active trk)" },
    device: "OP-XY", channel: "15 = active track (bus)", color: "#FF4D00",
    connection: "MIDI A → RK-006 → TRS A→B dongle", port: "MIDI A (RK-006)",
    source: "teenage.engineering OP-XY guide §23 + midi.guide OP-XY (62 params, Feb 2026)",
    lab: { ch: "15", dest: ["MIDI A"], pressure: "ChannelPressure · Highest", pressureCC: null, pb: "match OP-XY (else In-Tune 100%)", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "Receive toggle: com > devices (M4 page 2)" },
      { cap: "Pressure", status: "yes", note: "Channel AT received; assign as mod source via shift+instrument" },
      { cap: "Pitch bend", status: "yes", note: "Assignable mod source per preset" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: MIDI Channel = 15 — the bus plan gives OP-XY the active-track channel.",
      "Keys pressure: Expressivity Tune > Pressure → Enable, Type: Channel (single aftertouch stream).",
      "Faders: CC 7 / 9 / 10 / 46 on the same channel as the keys element.",
      "Scene buttons: ON Control Change CC 83 / 84 / 85, Enable Off: OFF — any value triggers these, so an enabled Off send would fire the scene change twice (once on press, again on release).",
      "Track-select row: 8 Buttons (Type: Control Change), channel 1 — ON Control Change: CC 102, Value 0…7 (one per track); OFF Control Change: disabled. With keys on ch 15, tapping a button re-aims the keys instantly.",
      "Transport buttons: ON CC 104 = play, ON CC 105 = stop; Enable Off: OFF on both.",
      "Output Destination: MIDI A (into the RK-006). Leave USB Device off unless also driving a DAW.",
      "Cable: RK-006 out → TRS A→B dongle (in the RK-006 cable bundle) → OP-XY MIDI in (TE = Type B wiring).",
    ],
    deviceSetup: [
      "com > M3 (devices): enable receive for notes, other (CCs), and velocity.",
      "shift + instrument (preset settings): assign aftertouch / mod wheel / pitch bend / velocity as synth mod sources.",
      "System settings > MIDI: set the active track channel to 15 (matches the keys element).",
    ],
    tip: "The channel IS the track: per-track CCs land on whichever track matches the sending channel, while performance CCs (tempo, scenes, transport, track select) work globally. Track select is the star: CC 102 on channel 1 with value 0–7 switches the active track — pair it with the keys on ch 15 (active-track channel) and one button row re-aims the whole layout.",
    mappings: [
      m("Keys / pads", "notes", "keys", "solid", "Plays track = element's channel"),
      m("Track volume", 7, "fader", "solid", "ch 1–16 = track"),
      m("Track mute", 9, "button", "solid", "ch = track"),
      m("Track pan", 10, "fader", "solid", "ch = track"),
      m("Track parameters", 46, "fader", "solid", "Engine macro, ch = track"),
      m("Tempo", 80, "fader", "solid", "any channel"),
      m("Scene select", 85, "fader", "solid", "any channel"),
      m("Prev / next scene", "83 / 84", "button", "solid", "any channel"),
      m("Track select ×8", 102, "button", "solid", "ch 1 only · value 0–7 = trk 1–8, 8–15 = aux"),
      m("Play / stop", "104 / 105", "button", "solid", "any channel"),
      m("Filter cutoff", 32, "xy", "solid", "ch 1–8 · XY horizontal"),
      m("Filter resonance", 33, "xy", "solid", "ch 1–8 · XY vertical"),
      m("Amp A/D/S/R", "20–23", "fader", "solid", "ch = track"),
      m("EQ", 90, "fader", "solid", "ch 1=low, 2=mid, 3=high"),
    ],
  },
  {
    libKey: "op1field", chans: [], route: "widi", blurb: "TE tape studio — BLE MIDI only",
    diagSub: { rk: "BLE MIDI · any ch (mixer 1–4)", thru: "BLE MIDI · any ch (mixer 1–4)" },
    device: "OP-1 Field", channel: "any (mixer: 1–4)", color: "#5AC8FA",
    connection: "Bluetooth LE via WIDI (fed from MIDI B)", port: "MIDI B → WIDI",
    source: "TE OP-1 field guide + midi.guide OP-1 field (61 params, May 2026 / fw 1.7)",
    lab: { ch: "1 (any)", dest: ["MIDI B"], pressure: "off — use Pressure CC", pressureCC: "1 → MIDI LFO", pb: "match com > T1", mpe: false },
    expression: [
      { cap: "Velocity", status: "verify", note: "Original OP-1 ignored incoming velocity — test on field" },
      { cap: "Pressure", status: "map", note: "No aftertouch receive; send Pressure CC to 1–4 and route via MIDI LFO" },
      { cap: "Pitch bend", status: "yes", note: "Handled in com > T1 MIDI settings" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: any channel (match com > T1 setting).",
      "Keys pressure: Control Change > Pressure lane → Enable, Type CC, Controller 1 — the Field's MIDI LFO routes CC 1–4 anywhere.",
      "Faders: fixed map CC 46–61 (params / ADSR / FX / LFO), any channel.",
      "Slot-select row: 8 Buttons, each on its own channel (1–8 = sound slots) — ON Control Change: CC 102, Value 127; Enable Off: OFF.",
      "Mode toggle: Button with Latched ON — On value 127 (drum) / Off value 0 (synth) on CC 93. Tape transport: ON-only buttons for play 105, stop 104, loop in/out/toggle 86/87/88.",
      "Output Destination: MIDI B → WIDI adapter → Bluetooth LE into the Field — the route that actually works in this rig; skip USB entirely.",
    ],
    deviceSetup: [
      "Pair the WIDI with the Field's Bluetooth MIDI (com screen); power the WIDI first so it auto-reconnects.",
      "com > T1: set receive channel, enable notes + other MIDI (CC) handling.",
      "shift + T4 from any synth/drum patch: open the MIDI LFO and assign CC 1–4 to internal destinations — this is where Erae pressure lands.",
    ],
    tip: "No TRS/DIN — Bluetooth LE via WIDI is the route that works here. Firmware 1.7 added real remote control: CC 102 selects sound slots 1–8 (the channel picks the slot), CC 93 flips synth/drum mode, and the tape answers to play/stop/loop CCs. Synth params + ADSR + FX + LFO remain fixed CCs on any channel, doubling as drum-patch controls. CC 1–4 stay freely routable via the MIDI LFO (shift+T4).",
    mappings: [
      m("Keys", "notes", "keys", "solid", ""),
      m("Synth param 1–4", "46–49", "fader", "solid", "Drum: pitch / loop in / loop out / mode"),
      m("Env attack", 50, "fader", "solid", "Drum: env attack"),
      m("Env decay", 51, "fader", "solid", "Drum: gain"),
      m("Env sustain", 52, "fader", "solid", "Drum: release"),
      m("Env release", 53, "fader", "solid", "Drum: smooth"),
      m("FX params 1–4", "54–57", "fader", "solid", ""),
      m("LFO params 1–4", "58–61", "fader", "solid", ""),
      m("Mixer volume", 7, "fader", "solid", "ch 1–4 = tape track"),
      m("Mixer mute / pan", "9 / 10", "fader", "solid", "ch 1–4; mute ≥64 = muted"),
      m("Sound slot select ×8", 102, "button", "solid", "value ≥64 · ch 1–8 = slots 1–8"),
      m("Synth / drum mode", 93, "button", "solid", "0–63 = synth, 64–127 = drum"),
      m("Tape play / stop", "105 / 104", "button", "solid", "any channel · ≥64 triggers"),
      m("Loop in / out / toggle", "86 / 87 / 88", "button", "solid", "any channel"),
      m("Prev / next bar", "82 / 83", "button", "solid", "any channel"),
      m("MIDI LFO lanes", "1–4", "xy", "custom", "Assign destinations via shift+T4"),
    ],
  },
  {
    libKey: "digitone2", chans: [14], route: "bus", thru: true, blurb: "Elektron FM — full CC map",
    diagSub: { rk: "TRS-A→DIN cable · auto ch 14", thru: "straight DIN · auto ch 14" },
    device: "Digitone 2", channel: "auto ch 14 (bus)", color: "#C77DFF",
    connection: "MIDI A → RK-006 → TRS-A→DIN cable", port: "MIDI A (RK-006)",
    source: "Elektron Digitone II MIDI appendix (via midi.guide, 336 params)",
    lab: { ch: "14 (auto)", dest: ["MIDI A"], pressure: "ChannelPressure · Highest", pressureCC: null, pb: "match track setting", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "Velocity mod destinations per preset (setup > velocity mod)" },
      { cap: "Pressure", status: "likely", note: "Channel AT received as mod source — confirm on OS version" },
      { cap: "Pitch bend", status: "yes", note: "" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: channel 14 = the Digitone AUTO channel (follows whatever track is active).",
      "Keys pressure: Expressivity Tune > Pressure → Enable, Type: Channel.",
      "XY (Fader 2D): CC X = 16 (filter freq), CC Y = 17 (resonance), same channel.",
      "Output Destination: MIDI A; RK-006 out → TRS-A→DIN cable → Digitone MIDI IN.",
    ],
    deviceSetup: [
      "Settings > MIDI Config > Channels: AUTO ch = 14; disable unused per-track channels so they don't occupy bus channels.",
      "Settings > MIDI Config > Port Config: enable receive on the input you're using.",
      "Per preset: set velocity / aftertouch mod destinations (setup menus) so expression actually moves something.",
    ],
    tip: "Set the element channels to the Digitone track's channel (or the AUTO channel to follow the active track). Note the un-Elektron-obvious bits: filter freq/res are CC 16/17, and SYN page-1 knobs A–H are CC 40–47 regardless of machine.",
    mappings: [
      m("Keys", "notes", "keys", "solid", "Active / auto-channel track"),
      m("Filter frequency", 16, "xy", "solid", "XY horizontal"),
      m("Filter resonance", 17, "xy", "solid", "XY vertical"),
      m("Filter env depth", 24, "fader", "solid", ""),
      m("Filter env A/D/S/R", "20–23", "fader", "solid", ""),
      m("Amp attack", 84, "fader", "solid", ""),
      m("Amp release", 88, "fader", "solid", ""),
      m("SYN page 1 (A–H)", "40–47", "fader", "solid", "Engine-dependent macros"),
      m("Track level", 95, "fader", "solid", ""),
      m("Delay / reverb send", "30 / 31", "fader", "solid", "Chorus send = 29"),
      m("Overdrive", 81, "fader", "solid", ""),
    ],
  },
  {
    libKey: "m8", chans: [13], route: "bus", blurb: "Tracker — map-anything CCs",
    diagSub: { rk: "TRS-A minijack · ch 13", thru: "DIN→TRS Type A · ch 13" },
    device: "Dirtywave M8", channel: "13 (bus)", color: "#3ED47A",
    connection: "MIDI A → RK-006 → straight TRS-A minijack", port: "MIDI A (RK-006)",
    source: "Dirtywave M8 manual — MIDI Mapping View (no fixed CC map)",
    lab: { ch: "13", dest: ["MIDI A"], pressure: "off — use Pressure CC", pressureCC: "27 → bind in Mapping View", pb: "per instrument", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "" },
      { cap: "Pressure", status: "map", note: "Send Pressure CC, then bind it to any parameter in Mapping View" },
      { cap: "Pitch bend", status: "yes", note: "Per-instrument pitch bend support" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: channel 13; set the M8 instrument input channel to 13.",
      "Keys pressure: Control Change > Pressure lane → Enable, Type CC, Controller 27 — then bind it on the M8 side.",
      "XY (Fader 2D): CC 74 / 71 as your standing mod lanes.",
      "Output Destination: MIDI A; RK-006 out → plain TRS minijack cable → M8 MIDI in (both Type A).",
    ],
    deviceSetup: [
      "Project > MIDI Settings: confirm input channels and the control-map channel (default 10).",
      "MIDI Mapping View: cursor on a parameter, hold [OPTION], move the Erae control to bind (up to 128 per song).",
      "Mutes/solos: notes 12–19 on the control-map channel — matches the pads row in this preset.",
    ],
    tip: "The M8 has no predefined CC map — up to 128 user mappings per song. To bind: cursor on any parameter, hold [OPTION], move the Erae control. So pick a consistent CC lane bank here and reuse it across songs. Mutes/solos and song-row cues respond to notes on the control-map channel (default 10).",
    mappings: [
      m("Keys", "notes", "keys", "solid", "Per-track MIDI input channel"),
      m("Mod lane A", 1, "fader", "custom", "Bind via [OPTION]+move in Mapping View"),
      m("Mod lane B (XY-X)", 74, "xy", "custom", "Cutoff-style sweep"),
      m("Mod lane C (XY-Y)", 71, "xy", "custom", "Resonance-style sweep"),
      m("Mod lanes D–F", "2, 75, 76", "fader", "custom", "Reserve for sends / env"),
      m("Track mutes 1–8", "notes 12–19", "pads", "solid", "Control-map channel (default 10)"),
      m("Song row cues", "notes", "pads", "solid", "Control-map channel"),
    ],
  },
  {
    libKey: "microfreak", chans: [11], route: "bus", blurb: "Arturia hybrid — verified chart",
    diagSub: { rk: "TRS-A minijack · ch 11", thru: "DIN→TRS Type A · ch 11" },
    device: "MicroFreak", channel: "11 (bus)", color: "#FFD23F",
    connection: "MIDI A → RK-006 → straight TRS-A minijack", port: "MIDI A (RK-006)",
    source: "Arturia MicroFreak MIDI implementation chart",
    lab: { ch: "11", dest: ["MIDI A"], pressure: "ChannelPressure · Highest (test)", pressureCC: null, pb: "match Utility setting", mpe: false },
    expression: [
      { cap: "Velocity", status: "likely", note: "Responds to incoming velocity" },
      { cap: "Pressure", status: "verify", note: "Matrix 'Press' source is local keybed — test if external AT feeds it" },
      { cap: "Pitch bend", status: "yes", note: "" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: channel 11 (bus plan) — move the MicroFreak off its default ch 1.",
      "Keys pressure: Expressivity Tune > Pressure → Enable, Type: Channel — verify the MicroFreak responds; if not, CC faders still cover expression.",
      "XY (Fader 2D): CC X = 23 (cutoff), CC Y = 83 (resonance).",
      "Output Destination: MIDI A; RK-006 out → plain TRS minijack cable → MicroFreak MIDI in (both Type A, no DIN adapter needed).",
    ],
    deviceSetup: [
      "Utility > MIDI: input channel = 11.",
      "Matrix: route the Press row (and Cycling Env) to targets if using pressure expression.",
    ],
    tip: "Fully verified chart. Cutoff + resonance on an XY element is the money layout; oscillator Type/Wave/Timbre/Shape as a four-fader bank recreates the top panel.",
    mappings: [
      m("Keys", "notes", "keys", "solid", "Paraphonic — up to 4 voices"),
      m("Cutoff", 23, "xy", "solid", "XY horizontal"),
      m("Resonance", 83, "xy", "solid", "XY vertical"),
      m("Osc Type", 9, "fader", "solid", ""),
      m("Osc Wave", 10, "fader", "solid", ""),
      m("Osc Timbre", 12, "fader", "solid", ""),
      m("Osc Shape", 13, "fader", "solid", ""),
      m("Env attack", 105, "fader", "solid", ""),
      m("Env decay / release", 106, "fader", "solid", ""),
      m("Env sustain", 29, "fader", "solid", ""),
      m("Cycling env rise / fall", "102 / 103", "fader", "solid", "Hold 28, amount 24"),
      m("Glide", 5, "fader", "solid", ""),
      m("Filter amount", 26, "fader", "likely", "Per chart continuation"),
      m("LFO rate (free)", 93, "fader", "likely", "ARP/SEQ rate = 91"),
      m("Hold", 64, "button", "solid", ""),
    ],
  },
  {
    libKey: "s1", chans: [12], route: "bus", blurb: "AIRA poly — every knob has a CC",
    diagSub: { rk: "TRS-A minijack · ch 12", thru: "DIN→TRS Type A · ch 12" },
    device: "Roland S-1", channel: "12 (bus)", color: "#FF5C8A",
    connection: "MIDI A → RK-006 → straight TRS-A minijack", port: "MIDI A (RK-006)",
    source: "Roland S-1 MIDI implementation chart v1.02 (via midi.guide)",
    lab: { ch: "12", dest: ["MIDI A"], pressure: "off — optional Pressure CC", pressureCC: "24 (filter env depth)", pb: "match S-1", mpe: false },
    expression: [
      { cap: "Velocity", status: "likely", note: "" },
      { cap: "Pressure", status: "no", note: "No aftertouch receive — use Pressure CC into a mappable CC instead" },
      { cap: "Pitch bend", status: "yes", note: "LFO section can shape received bend/mod" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: channel 12 (bus plan) — move the S-1 off its default ch 3.",
      "XY (Fader 2D): CC X = 74 (cutoff), CC Y = 71 (resonance), channel 12.",
      "Optional squeeze: Control Change > Pressure → Enable, Type CC, Controller 24 (filter env depth).",
      "Output Destination: MIDI A; RK-006 out → plain TRS minijack cable → S-1 MIDI in (both Type A).",
    ],
    deviceSetup: [
      "Utility settings: set the receive channel to 12.",
      "No further mapping needed — every panel knob already listens on its fixed CC.",
    ],
    tip: "S-1 receives on channel 3 out of the box (configurable in utility). Every front-panel knob has a CC — this fader map recreates the whole SH-101-style panel. D-MOTION and the noise Riser are the only things you can't reach over MIDI.",
    mappings: [
      m("Keys", "notes", "keys", "solid", "4-voice poly"),
      m("Cutoff", 74, "xy", "solid", "XY horizontal"),
      m("Resonance", 71, "xy", "solid", "XY vertical"),
      m("Env attack", 73, "fader", "solid", ""),
      m("Env decay", 75, "fader", "solid", ""),
      m("Env sustain", 30, "fader", "solid", ""),
      m("Env release", 72, "fader", "solid", ""),
      m("Filter env depth", 24, "fader", "solid", ""),
      m("Filter LFO depth", 25, "fader", "solid", ""),
      m("LFO rate", 3, "fader", "solid", "Waveform = 12"),
      m("Square / saw / sub level", "19 / 20 / 21", "fader", "solid", "Noise level = 23"),
      m("Pulse width", 15, "fader", "solid", "PWM source = 16"),
      m("Reverb / delay level", "91 / 92", "fader", "solid", "Times: 89 / 90"),
    ],
  },
  {
    libKey: "sp404", chans: [1,2,3,4,5,6,7,8,9,10,16], route: "bus", blurb: "Sampler — fixed pad/bank map",
    diagSub: { rk: "TRS-A · ch 1–10 + 16 (port-filtered)", thru: "DIN→TRS Type A · ch 1–10 + 16" },
    device: "SP-404 MKII", channel: "1–10 = bank", color: "#FF9F1C",
    connection: "MIDI A → RK-006 → straight TRS-A minijack", port: "MIDI A (RK-006)",
    source: "Roland SP-404MK2 reference manual v5 — MIDI implementation chart",
    lab: { ch: "1 = bank A", dest: ["MIDI A"], pressure: "off — pads are velocity-only", pressureCC: null, pb: "n/a", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "Pads respond to note velocity" },
      { cap: "Pressure", status: "no", note: "No aftertouch — pads are trigger + velocity only" },
      { cap: "Pitch bend", status: "no", note: "" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Drumpad element: 4×4, Base Note 36, channel = bank (A = ch 1 … J = ch 10).",
      "Optional chromatic keys element: channel 16, notes 36–60 plays the active pad chromatically.",
      "Faders: FX Ctrl CCs with channel = the bus (1–4) you want to grab.",
      "Output Destination: MIDI A. On the RK-006, filter this port to the 404's fixed ch 1–10 + 16 so stray bus traffic never mistriggers pads.",
    ],
    deviceSetup: [
      "Utility: select MIDI Mode A (bank-per-channel). Note/channel assignments are fixed on the 404.",
      "Pick which bus each Erae fader group targets — channel = bus.",
    ],
    tip: "MIDI Mode A: banks A–J sit on channels 1–10, pads fire notes 36–51 in every bank, and the map is fixed (not editable on the 404). Bus FX live on their own channels: ch 1–4 = BUS 1–4, ch 5 = input. Chromatic sample play: channel 16, notes 36–60.",
    mappings: [
      m("Pads (bank = channel)", "notes 36–51", "pads", "solid", "4×4 grid; bank A = ch 1 … J = ch 10"),
      m("Chromatic play", "notes 36–60", "keys", "solid", "ch 16, active pad"),
      m("FX Ctrl 1 / 2 / 3", "16 / 17 / 18", "fader", "solid", "ch = bus 1–4, ch 5 = input"),
      m("FX Ctrl 4 / 5 / 6", "80 / 81 / 82", "fader", "solid", "ch = bus"),
      m("EFX on / off", 19, "button", "solid", "≥64 = on, ch = bus"),
      m("EFX select", 83, "fader", "solid", "0–127 = effect number"),
    ],
  },
  {
    libKey: "tx6", chans: [], route: "usbhost", blurb: "TE mixer — USB/BLE MIDI only",
    diagSub: { rk: "USB Host · ch 1–6 = trk, 7 = master", thru: "USB Host · ch 1–6 = trk, 7 = master" },
    device: "TX-6", channel: "1–6 = track, 7 = master", color: "#B9BDC4",
    connection: "USB Host (direct)", port: "USB Host",
    source: "teenage.engineering TX-6 guide — midi reference (incoming messages)",
    lab: { ch: "1–6 per fader", dest: ["USB HOST"], pressure: "off — optional Pressure CC", pressureCC: "91 (FX I send)", pb: "n/a", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "Internal synth plays chromatically from MIDI notes" },
      { cap: "Pressure", status: "map", note: "Mixer control — pressure only useful as extra CC (e.g. FX send)" },
      { cap: "Pitch bend", status: "no", note: "" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    eraeSetup: [
      "Six Fader 1D elements: all CC 7, channels 1–6 (one per track) — that's the whole mixer.",
      "Optional per-fader squeeze: Control Change > Pressure → Enable, Type CC, Controller 91 (FX I send) — push harder into a fader to send to FX.",
      "Master fader: CC 7 on channel 7. Start/stop button: CC 46, channel 7.",
      "Output Destination: USB Host — the TX-6 has no TRS MIDI, so it gets the host port to itself (private channel space, no bus collisions).",
      "If the host port misbehaves (known firmware quirk), put a powered hub between them.",
    ],
    deviceSetup: [
      "System menu: MIDI CC = ON (nothing responds until this is enabled).",
      "If using Bluetooth: enable BLE in the system menu and pair.",
    ],
    tip: "Enable MIDI CC in the TX-6 system menu first. The channel is the track: six Erae faders on CC 7, channels 1–6, is the whole mixer. Master lives on ch 7, FX I/II engines on ch 8/9. Sending CC 120 toggles mute/solo per track.",
    mappings: [
      m("Track level ×6", 7, "fader", "solid", "Six faders, ch 1–6"),
      m("Pan / balance", 8, "fader", "solid", "ch = track"),
      m("Gain", 9, "fader", "solid", "ch = track"),
      m("EQ high / mid / low", "85 / 86 / 87", "fader", "solid", "ch = track"),
      m("Filter frequency", 74, "fader", "solid", "ch = track"),
      m("Compressor amount", 93, "fader", "solid", "ch = track"),
      m("FX I send", 91, "fader", "solid", "Aux 92, aux II 94, ch = track"),
      m("Mute / solo", 120, "button", "solid", "ch = track, ≥64 = on"),
      m("Main volume", 7, "fader", "solid", "ch 7 · aux 14, cue 15"),
      m("Start / stop", 46, "button", "solid", "ch 7 · tempo nudge 47"),
      m("FX I/II params 1–3", "12–14", "fader", "solid", "ch 8 / 9 · engine 15, enable 82"),
    ],
  },
  {
    libKey: "gameboy_mgb", chans: [1,2,3,4,5], route: "bus", blurb: "DMG/GBC synth via Arduinoboy — 5 voices, 5 channels",
    diagSub: { rk: "TRS-A minijack → Arduinoboy · ch 1–5", thru: "DIN→TRS Type A → Arduinoboy · ch 1–5" },
    device: "Game Boy · mGB", channel: "1–5 = voice", color: "#9BE564",
    connection: "MIDI A → RK-006 → Arduinoboy TRS in (set Type A)",
    source: "trash80/mGB README (MIDI implementation) · trash80/Arduinoboy mode 5 · ProMicroGal v1.2 listing",
    lab: { ch: "1 (PU1) / 5 (poly)", dest: ["MIDI A"], pressure: "off — use Pressure CC", pressureCC: "1 (pulse width)", pb: "= CC 4 value on channel", mpe: false },
    tip: "Arduinoboy in mode 5 passes full MIDI to mGB, where the channel is the voice: PU1 ch 1, PU2 ch 2, WAV ch 3, NOI ch 4, and ch 5 plays PU1/PU2/WAV as a 3-voice poly. mGB's channels are fixed at 1–5 unless remapped in the Arduinoboy Max editor — the bus status below flags any collisions with the current rig.",
    expression: [
      { cap: "Velocity", status: "yes", note: "Scales the envelope; same-velocity overlaps don't retrigger" },
      { cap: "Pressure", status: "map", note: "No aftertouch — Pressure CC → CC 1 (pulse width) is the classic squeeze" },
      { cap: "Pitch bend", status: "yes", note: "Range set by CC 4: PU ±12, NOI ±24, poly ±2" },
      { cap: "MPE", status: "no", note: "Keep MPE off on this element" },
    ],
    mappings: [
      m("Keys (PU1 lead)", "notes", "keys", "solid", "ch 1 — duplicate on ch 5 for poly"),
      m("Pulse width PU1/PU2", 1, "fader", "solid", "Quantized: 0 / 32 / 64 / 127"),
      m("Envelope PU1/PU2/NOI", 2, "fader", "solid", "16 steps"),
      m("Pitch sweep PU1/WAV", 3, "fader", "solid", "WAV: 0 = off, 1–127 = speed"),
      m("WAV shape select", 1, "fader", "solid", "ch 3 — 16 shapes"),
      m("WAV shape offset", 2, "fader", "solid", "ch 3 — 32 positions"),
      m("Pitch bend range", 4, "fader", "solid", "Per voice channel"),
      m("Pan", 10, "fader", "solid", "GB hard L/C/R pan"),
      m("Sustain", 64, "button", "solid", "≥64 = on"),
      m("Load preset", 5, "fader", "solid", "Also PC 1–15"),
    ],
    eraeSetup: [
      "Keys element: channel 1 (PU1) to start; add a second keys element on ch 5 for poly mode.",
      "Faders: CC 1 / 2 / 3 / 10 on the matching voice channel — pulse width, envelope, sweep, pan.",
      "Keys pressure: Control Change > Pressure → Enable, Type CC, Controller 1 — finger pressure sweeps pulse width, the signature mGB move.",
      "Pitch Bend Range on the element must equal what you set via CC 4 on the same channel.",
      "Output Destination: MIDI A; RK-006 out → plain TRS minijack → Arduinoboy TRS MIDI in.",
    ],
    deviceSetup: [
      "Flash cart loaded with mGB in the Game Boy; link cable from the Arduinoboy's GB link port.",
      "Set the Arduinoboy's TRS mini-switches to Type A (matches the RK-006's outs directly).",
      "Click the mode switch to mode 5 (mGB) — or set boot mode in the Arduinoboy Max editor.",
      "Power the Arduinoboy via USB-C. Do NOT close jumper JP1 while USB power is connected.",
      "Optional: use the Max editor's mGB settings to remap incoming channels per GB voice.",
    ],
  },
  {
    libKey: "ableton_move", chans: [], route: "usbhost", blurb: "Ableton groovebox — notes + poly AT only, no CC",
    diagSub: { rk: "USB Host · Move USB-C · notes + poly AT", thru: "USB Host · Move USB-C · notes + poly AT" },
    device: "Ableton Move", channel: "Auto (selected track receives)", color: "#FFC94D",
    connection: "USB Host → Move USB-C (Move ≥ 1.7, Standalone Mode)", port: "USB Host",
    source: "Ableton Move manual §4.1.3 + §2.1.7 · Move release notes 1.2.0/1.3.0/1.5.0/1.7.0 (Oct 2025)",
    lab: { ch: "any (Move: Auto)", dest: ["USB HOST"], pressure: "Polyphonic (per-note)", pressureCC: null, pb: "verify — receive undocumented", mpe: false },
    expression: [
      { cap: "Velocity", status: "yes", note: "Full velocity on notes in and out" },
      { cap: "Pressure", status: "yes", note: "Polyphonic AT received (and sent since fw 1.3) — set the Erae pressure type to Polyphonic, not Channel" },
      { cap: "Pitch bend", status: "verify", note: "Not documented either way — test on hardware" },
      { cap: "MPE", status: "no", note: "Poly AT ≠ MPE; keep MPE off on this element" },
    ],
    eraeSetup: [
      "Keys element: any channel — with Move's tracks on MIDI In: Auto, whichever track is selected on Move receives the notes.",
      "Keys pressure: Expressivity Tune > Pressure → Enable, Type: Polyphonic — Move is one of the few boxes that honors true per-note pressure from the Erae.",
      "Optional drum grid: a second pads element for Move's drum track — capture the pad→note layout from Move first (undocumented; verify).",
      "Skip faders, XY, and CC buttons for this device: Move ignores all Control Change and Program Change (manual §4.1.3). Spend that surface on other rig devices.",
      "Output Destination: USB HOST. The default rig's TX-6 owns that port — share it through a powered USB hub, or swap the TX-6 out of the slot.",
    ],
    deviceSetup: [
      "Update Move to firmware 1.7.0 or later — USB-C MIDI toward a USB host (the Erae) arrived in 1.7.",
      "Stay in Standalone Mode: MIDI send/receive is disabled while Move is in Control Live Mode.",
      "Setup > MIDI: enable MIDI In. Per track: Shift + track button → press the wheel → MIDI In → Auto (or a fixed channel for per-track zones).",
      "Cable: Move's USB-C into the hub/host port. Move runs on its own battery; the link is data.",
    ],
    tip: "Notes in, notes out — that's the whole contract: Move ignores CC, Program Change, and channel aftertouch, so no fader or XY element will ever reach it. What it does receive is polyphonic aftertouch, which the Erae sends natively — per-finger pressure lands per pad. With MIDI In on Auto, Move's selected track receives everything; pin tracks to fixed channels instead if you want four dedicated Erae zones. Move can also send MIDI clock to the rig (fw 1.2+); clock receive is newer — verify on your firmware.",
    mappings: [
      m("Keys / pads", "notes", "keys", "solid", "Auto: plays Move's selected track"),
      m("Per-track zones ×4", "notes", "keys", "custom", "Set Move tracks to fixed ch 1–4 instead of Auto"),
      m("Drum track grid", "notes", "keys", "verify", "Pad→note layout undocumented — capture from Move"),
      m("Poly aftertouch", "notes", "keys", "solid", "Pressure type: Polyphonic on the same element"),
    ],
  },
  {
    libKey: "custom", chans: [], route: "bus", blurb: "Blank template — start from scratch",
    diagSub: { rk: "TRS-A / adapter · set channel", thru: "DIN cable · set channel" },
    device: "Custom device", channel: "set me", color: "#8FA1FF",
    connection: "MIDI A → RK-006 → (choose cable)",
    source: "user-defined",
    lab: { ch: "?", dest: ["MIDI A"], pressure: "set after checking manual", pressureCC: null, pb: "match device", mpe: false },
    tip: "Blank slate. Fill in the channel scheme, add the primary controls from the device's MIDI implementation chart, and note the cable type from the RK-006.",
    expression: [
      { cap: "Velocity", status: "verify", note: "" },
      { cap: "Pressure", status: "verify", note: "" },
      { cap: "Pitch bend", status: "verify", note: "" },
      { cap: "MPE", status: "no", note: "Assume no unless the manual says otherwise" },
    ],
    mappings: [
      m("Keys", "notes", "keys", "verify", ""),
      m("New control", "", "fader", "verify", ""),
    ],
    eraeSetup: [
      "Keys element: set the channel to match the device.",
      "Output Destination: MIDI A (RK-006) unless the device is USB/BLE-only.",
    ],
    deviceSetup: [
      "Check the device's MIDI receive channel and enable CC receive if needed.",
    ],
  },
];

const DEFAULT_RIG_KEYS = ["opxy", "op1field", "digitone2", "m8", "microfreak", "s1", "sp404", "tx6"];

const instantiate = (libKey) => {
  const t = DEVICE_LIBRARY.find((d) => d.libKey === libKey) || DEVICE_LIBRARY[DEVICE_LIBRARY.length - 1];
  const c = JSON.parse(JSON.stringify(t));
  return { ...c, id: uid(), mappings: c.mappings.map((r) => ({ ...r, id: uid() })) };
};

const ELEMENT_TYPES = ["fader", "keys", "pads", "xy", "button"];
const STORAGE_KEY = "erae2-midi-map-v10";

// ---------- small components ----------
function ConfBadge({ conf, onCycle }) {
  const c = CONF[conf] || CONF.verify;
  return (
    <button
      onClick={onCycle}
      title={c.tip + " — click to change"}
      style={{
        fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1,
        color: c.color, border: `1px solid ${c.color}55`, background: `${c.color}14`,
        borderRadius: 3, padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </button>
  );
}

function Field({ value, onChange, width, mono, placeholder, center }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "transparent", border: "1px solid transparent", borderRadius: 4,
        color: C.text, padding: "4px 6px", width: width || "100%",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
        fontSize: IS_TOUCH ? 16 : (mono ? 12 : 13), textAlign: center ? "center" : "left", outline: "none",
      }}
      onFocus={(e) => { e.target.style.borderColor = C.orange; e.target.style.background = C.panelUp; }}
      onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
    />
  );
}



// ---------- rig topology helpers ----------
const fmtChans = (arr) => {
  if (!arr || !arr.length) return "—";
  const s = [...arr].sort((a, b) => a - b);
  const out = [];
  let start = s[0], prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === prev + 1) { prev = s[i]; continue; }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = s[i];
  }
  return out.join(", ");
};

const computePorts = (rig, mode) => {
  if (mode !== "direct") {
    return rig.map((d) => ({
      port: d.route === "usbhost" ? "USB Host"
        : d.route === "widi" ? "MIDI B → WIDI"
        : mode === "rk006" ? "MIDI A · RK-006" : "MIDI A · thru box",
      connected: true, chainParent: null,
    }));
  }
  const free = { host: true, a: true, b: true };
  const out = rig.map(() => null);
  // pass 1: physical lines, slot order
  rig.forEach((d, i) => {
    if (d.route === "usbhost") {
      if (free.host) { free.host = false; out[i] = { port: "USB Host", connected: true, chainParent: null }; }
    } else if (d.route === "widi") {
      if (free.b) { free.b = false; out[i] = { port: "MIDI B → WIDI", connected: true, chainParent: null }; }
      else if (free.a) { free.a = false; out[i] = { port: "MIDI A → WIDI", connected: true, chainParent: null }; }
    } else {
      if (free.a) { free.a = false; out[i] = { port: "MIDI A", connected: true, chainParent: null }; }
      else if (free.b) { free.b = false; out[i] = { port: "MIDI B", connected: true, chainParent: null }; }
    }
  });
  // pass 2: chain remaining bus devices off connected MIDI-THRU devices (e.g. Digitone 2)
  const thruHosts = [];
  rig.forEach((d, i) => { if (out[i] && d.thru && d.route === "bus") thruHosts.push({ i, used: false }); });
  rig.forEach((d, i) => {
    if (out[i] || d.route !== "bus") return;
    const host = thruHosts.find((h) => !h.used);
    if (host) {
      host.used = true;
      out[i] = { port: `THRU ← ${rig[host.i].device}`, connected: true, chainParent: host.i };
      if (d.thru) thruHosts.push({ i, used: false }); // a chained thru device extends the chain
    }
  });
  return out.map((x) => x || { port: null, connected: false, chainParent: null });
};

// collisions exist only on a shared bus (rk006 / thrubox modes)
const collideGroups = (groups) => {
  const byPair = {};
  groups.forEach((group) => {
    const seen = {};
    group.forEach((x) => (x.d.chans || []).forEach((c) => { (seen[c] = seen[c] || []).push(x); }));
    Object.entries(seen).forEach(([c, v]) => {
      if (v.length < 2) return;
      const key = v.map((q) => q.i).sort((a, b) => a - b).join("|");
      (byPair[key] = byPair[key] || { devs: v, chans: [] }).chans.push(+c);
    });
  });
  return Object.values(byPair);
};

const computeCollisions = (rig, mode, portInfo) => {
  const ann = rig.map((d, i) => ({ d, i }));
  if (mode !== "direct") {
    return collideGroups([ann.filter((x) => x.d.route === "bus")]);
  }
  // direct mode: each THRU chain is its own shared line
  const chains = {};
  ann.forEach((x) => {
    const pi = portInfo[x.i];
    if (!pi || !pi.connected) return;
    let root = x.i;
    let guard = 0;
    while (portInfo[root].chainParent != null && guard++ < 16) root = portInfo[root].chainParent;
    (chains[root] = chains[root] || []).push(x);
  });
  return collideGroups(Object.values(chains).filter((g) => g.length > 1));
};

// ---------- visual guide components ----------
const ALL_DESTS = ["USB DEVICE", "MIDI A", "MIDI B", "USB HOST"];
const destActive = (dest, name) =>
  dest.some((d) => name.toLowerCase().replace(" ", "").includes(d.toLowerCase().replace(" ", "").slice(0, 6)) ||
                   d.toLowerCase().replace(" ", "").includes(name.toLowerCase().replace(" ", "").slice(0, 6)));

function DestPills({ dest }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {ALL_DESTS.map((n) => {
        const on = destActive(dest, n);
        return (
          <span key={n} style={{
            fontFamily: "ui-monospace, monospace", fontSize: 8.5, letterSpacing: 0.6,
            padding: "3px 7px", borderRadius: 3,
            color: on ? "#0F0F10" : C.faint,
            background: on ? C.green : "transparent",
            border: `1px solid ${on ? C.green : C.line}`,
            fontWeight: on ? 700 : 400,
          }}>{n}</span>
        );
      })}
    </div>
  );
}

function LabSettingsCard({ p }) {
  const lab = p.lab || {};
  const row = (label, node) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.line}` }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.2, color: C.faint }}>{label}</span>
      <span style={{ fontSize: 11, color: C.text, textAlign: "right" }}>{node}</span>
    </div>
  );
  return (
    <div style={{ flex: "1 1 290px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.5, color: C.dim }}>
          ERAE LAB · ELEMENT SETTINGS (KEYS)
        </span>
      </div>
      {row("MIDI CHANNEL", <b style={{ fontFamily: "ui-monospace, monospace", color: C.orange }}>{lab.ch || "—"}</b>)}
      {row("TRIG ON ENTRY", "Default")}
      {row("OUTPUT DESTINATION", <DestPills dest={lab.dest || []} />)}
      {row("PRESSURE", lab.pressure || "—")}
      {lab.pressureCC && row("PRESSURE CC", <b style={{ fontFamily: "ui-monospace, monospace", color: C.blue }}>{lab.pressureCC}</b>)}
      {row("PITCH BEND RANGE", lab.pb || "—")}
      {row("MPE", (
        <span style={{
          fontFamily: "ui-monospace, monospace", fontSize: 9, padding: "2px 8px", borderRadius: 3,
          color: C.red, border: `1px solid ${C.red}55`, background: `${C.red}12`, letterSpacing: 1,
        }}>OFF</span>
      ))}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 5 }}>
          ELEMENTS TO CREATE — CH · CC · DEST PER ELEMENT
        </div>
        {(p.mappings || []).map((r) => {
          const chMatch = (r.note || "").match(/ch(?:annel)?s?\s*=?\s*([0-9]+(?:\s*[–\-]\s*[0-9]+)?(?:\s*\+\s*[0-9]+)?)/i);
          const ch = chMatch ? chMatch[1].replace(/\s/g, "") : (lab.ch || "—");
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={{
                fontFamily: "ui-monospace, monospace", fontSize: 8, letterSpacing: 0.8, width: 44,
                color: p.color, flexShrink: 0, textTransform: "uppercase",
              }}>{r.type}</span>
              <span style={{ fontSize: 10.5, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.control}</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: C.blue, flexShrink: 0 }}>
                {String(r.cc).startsWith("note") ? r.cc : `CC ${r.cc}`}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: C.orange, width: 52, textAlign: "right", flexShrink: 0 }}>
                ch {ch}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: C.faint, width: 56, textAlign: "right", flexShrink: 0 }}>
                {(lab.dest && lab.dest[0]) || "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayoutPreview({ p }) {
  const maps = p.mappings || [];
  const nFad = Math.min(maps.filter((r) => r.type === "fader").length, 8);
  const hasXY = maps.some((r) => r.type === "xy");
  const hasKeys = maps.some((r) => r.type === "keys");
  const hasPads = maps.some((r) => r.type === "pads");
  const nBtn = Math.min(maps.filter((r) => r.type === "button").length, 8);
  const btnRow = nBtn > 0;
  const W = 320, H = 168 + (btnRow ? 16 : 0);
  const topY = 14, topH = hasKeys ? 92 : 138;
  let x = 12;
  const zones = [];
  if (hasPads) {
    zones.push(<g key="pads">{[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
      <rect key={`${r}${c}`} x={x + c * 20} y={topY + r * (topH / 4.4)} width="17" height={topH / 4.4 - 4} rx="3"
        fill={`${p.color}22`} stroke={`${p.color}66`} strokeWidth="0.8" />
    )))}
      <text x={x} y={topY + topH + (nBtn > 0 ? -2 : 11)} fill={C.faint} fontSize="8" fontFamily="ui-monospace, monospace">PADS 4×4</text>
    </g>);
    x += 92;
  }
  const xyW = 76;
  const fadEnd = W - 12 - (hasXY ? xyW + 10 : 0);
  if (nFad > 0) {
    const fw = Math.min(18, (fadEnd - x - (nFad - 1) * 6) / nFad);
    zones.push(<g key="fad">{Array.from({ length: nFad }).map((_, i) => (
      <g key={i}>
        <rect x={x + i * (fw + 6)} y={topY} width={fw} height={topH} rx="3"
          fill={`${p.color}18`} stroke={`${p.color}55`} strokeWidth="0.8" />
        <rect x={x + i * (fw + 6) + 2} y={topY + topH * (0.25 + (i % 3) * 0.18)} width={fw - 4} height="7" rx="2" fill={p.color} opacity="0.85" />
      </g>
    ))}
      <text x={x} y={topY - 4 > 8 ? topY - 4 : topY + topH + 11} fill={C.faint} fontSize="8" fontFamily="ui-monospace, monospace">{nFad} FADERS</text>
    </g>);
  }
  if (hasXY) {
    const xx = W - 12 - xyW;
    zones.push(<g key="xy">
      <rect x={xx} y={topY} width={xyW} height={topH} rx="4" fill={`${p.color}14`} stroke={`${p.color}66`} strokeWidth="0.8" />
      <line x1={xx} y1={topY + topH / 2} x2={xx + xyW} y2={topY + topH / 2} stroke={`${p.color}33`} strokeWidth="0.7" />
      <line x1={xx + xyW / 2} y1={topY} x2={xx + xyW / 2} y2={topY + topH} stroke={`${p.color}33`} strokeWidth="0.7" />
      <circle cx={xx + xyW * 0.62} cy={topY + topH * 0.38} r="5" fill={p.color} />
      <text x={xx + xyW - 14} y={topY + 12} fill={C.faint} fontSize="8" fontFamily="ui-monospace, monospace">XY</text>
    </g>);
  }
  if (btnRow) {
    const by = topY + topH + 4;
    zones.push(<g key="btn">
      {Array.from({ length: nBtn }).map((_, i) => (
        <rect key={i} x={12 + i * 20} y={by} width="16" height="13" rx="3"
          fill={`${p.color}30`} stroke={`${p.color}77`} strokeWidth="0.8" />
      ))}
      <text x={12 + nBtn * 20 + 4} y={by + 10} fill={C.faint} fontSize="8"
        fontFamily="ui-monospace, monospace">{nBtn} BTN</text>
    </g>);
  }
  return (
    <div style={{ flex: "1 1 290px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 6 }}>
        SUGGESTED LAYOUT · N-SLOT SURFACE
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="10" fill={C.panelUp} stroke={C.line} strokeWidth="1" />
        {zones}
        {hasKeys && (
          <g>
            <rect x="12" y={topY + topH + (btnRow ? 22 : 16)} width={W - 24} height={H - topY - topH - (btnRow ? 36 : 30)} rx="4"
              fill={`${p.color}18`} stroke={`${p.color}66`} strokeWidth="0.8" />
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={i} x1={12 + (i + 1) * (W - 24) / 15} y1={topY + topH + (btnRow ? 22 : 16)}
                x2={12 + (i + 1) * (W - 24) / 15} y2={H - 14} stroke={`${p.color}44`} strokeWidth="0.7" />
            ))}
            <text x="14" y={H - 4} fill={C.faint} fontSize="8" fontFamily="ui-monospace, monospace">KEYS · ch {(p.lab && p.lab.ch) || p.channel}</text>
          </g>
        )}
      </svg>
    </div>
  );
}


function ElementRecipes({ p }) {
  const lab = p.lab || {};
  const maps = p.mappings || [];
  const types = [...new Set(maps.map((r) => r.type))];
  const xyRows = maps.filter((r) => r.type === "xy");
  const padRow = maps.find((r) => r.type === "pads");
  const baseNote = padRow ? ((String(padRow.cc).match(/(\d+)/) || [])[1] || "36") : "36";
  const dest = (lab.dest && lab.dest[0]) || "MIDI A";
  const pressureChannel = (lab.pressure || "").toLowerCase().includes("channelpressure");
  const items = [];
  if (types.includes("keys")) items.push({
    h: "KEYBOARD / KEYGRID (keys)",
    steps: [
      `Midi Output: ${dest} ON, USB Device OFF (it defaults ON).`,
      `Midi: MPE OFF · Channel ${lab.ch || "—"} · Trig on entry: Default.`,
      `Default Values: PB Range → ${lab.pb || "match the device"}. Scale/Root/Octave to taste.`,
      pressureChannel
        ? "Expressivity Tune > Pressure: Enable ON, Type: Channel (single aftertouch stream)."
        : lab.pressureCC
        ? `Expressivity Tune > Pressure: leave OFF. Instead: Control Change > Pressure lane → Enable ON, Type CC, Controller ${String(lab.pressureCC).split(" ")[0]}.`
        : "Expressivity Tune > Pressure: leave OFF (device ignores aftertouch).",
      "Glissando: In Tune Width up toward 100 if slides land off-pitch on this device.",
    ],
  });
  if (types.includes("fader")) items.push({
    h: "FADER1D (each fader)",
    steps: [
      `Midi Output: ${dest} ON, USB Device OFF.`,
      "Midi: Channel per the element checklist above (multi-channel devices differ per fader).",
      "Control Change > Y abs tab: Enable ON, Type: CC, Controller = the CC from the checklist, Min/Max 0–127.",
      "Optional squeeze layer: Control Change > Pressure tab → Enable + a second CC.",
    ],
  });
  if (types.includes("xy")) items.push({
    h: "FADER2D (XY pad)",
    steps: [
      `Midi Output: ${dest} ON, USB Device OFF · Channel ${lab.ch || "per checklist"}.`,
      `Control Change > X abs tab: Enable ON, Type CC, Controller ${xyRows[0] ? xyRows[0].cc : "—"}.`,
      `Control Change > Y abs tab: Enable ON, Type CC, Controller ${xyRows[1] ? xyRows[1].cc : "—"}.`,
      "Default X/Y set the resting position; Center X/Y snap-back if you want spring behavior.",
    ],
  });
  if (types.includes("button")) items.push({
    h: "BUTTON (Type: Control Change)",
    steps: [
      `Midi Output: ${dest} ON, USB Device OFF · Channel per checklist.`,
      "TRIGGER buttons (track/slot select, scenes, play/stop): ON Control Change → Enable On, Type CC, Controller + Value from the checklist. OFF Control Change → Enable Off: OFF. If Off stays enabled, releasing the button fires the command a second time.",
      "HOLD buttons (sustain CC 64): Latched OFF · Enable On value 127 · Enable Off value 0.",
      "TOGGLE buttons (mutes, synth/drum mode): Latched ON · Enable On value 127 · Enable Off value 0 — each press alternates.",
    ],
  });
  if (types.includes("pads")) items.push({
    h: "DRUMPAD (pad grid)",
    steps: [
      `Midi Output: ${dest} ON, USB Device OFF · MPE OFF · Channel ${lab.ch || "per checklist"}.`,
      `Default Values: Root Note + Octave until pad 1 sends note ${baseNote} — verify in Settings > MIDI Monitor on the Erae.`,
      "Line Offset: Semitones = 4 on a 4-wide grid gives 16 contiguous notes (matches SP-404 pad order).",
      "Show Offscale ON so every pad lights regardless of scale.",
    ],
  });
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 8 }}>
        ERAE LAB RECIPES — EXACT INSPECTOR PATHS PER ELEMENT TYPE
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, letterSpacing: 1, color: p.color, marginBottom: 4 }}>{it.h}</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: C.dim, fontSize: 11.5, lineHeight: 1.65 }}>
            {it.steps.map((s, j) => <li key={j}>{s}</li>)}
          </ol>
        </div>
      ))}
    </div>
  );
}

function SetupGraphic({ kind, note, used }) {
  const usedN = used == null ? 6 : used;
  const mono = { fontFamily: "ui-monospace, monospace", fontSize: 8 };
  const pill = (x, y, w, text, on, color) => (
    <g key={text + x}>
      <rect x={x} y={y} width={w} height="16" rx="3" fill={on ? (color || C.green) : "transparent"}
        stroke={on ? (color || C.green) : C.line} strokeWidth="1" />
      <text x={x + w / 2} y={y + 11} textAnchor="middle" fill={on ? "#0F0F10" : C.faint}
        style={mono} fontWeight={on ? 700 : 400}>{text}</text>
    </g>
  );
  const arrow = (x1, y, x2) => (
    <g key={`a${x1}${y}`}>
      <line x1={x1} y1={y} x2={x2 - 5} y2={y} stroke={C.dim} strokeWidth="1.2" />
      <path d={`M ${x2 - 5} ${y - 3} L ${x2} ${y} L ${x2 - 5} ${y + 3}`} fill="none" stroke={C.dim} strokeWidth="1.2" />
    </g>
  );
  if (kind === "dest") return (
    <svg viewBox="0 0 560 78" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      <text x="0" y="12" fill={C.red} style={mono} letterSpacing="1">DEFAULT — SILENT TO HARDWARE</text>
      {pill(0, 20, 74, "USB DEVICE", true, C.faint)}{pill(78, 20, 52, "MIDI A", false)}{pill(134, 20, 52, "MIDI B", false)}{pill(190, 20, 62, "USB HOST", false)}
      {arrow(262, 28, 296)}
      <text x="306" y="12" fill={C.green} style={mono} letterSpacing="1">FIXED — PER ELEMENT</text>
      {pill(306, 20, 74, "USB DEVICE", false)}{pill(384, 20, 52, "MIDI A", true)}{pill(440, 20, 52, "MIDI B", false)}{pill(496, 20, 62, "USB HOST", false)}
      <text x="0" y="66" fill={C.faint} style={mono}>every element · Erae Lab inspector → MIDI OUTPUT toggles (order as shown in the panel)</text>
    </svg>
  );
  if (kind === "trs") return (
    <svg viewBox="0 0 560 86" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      {[["TYPE A", 0, "M8 · MicroFreak · S-1 · SP-404 · RK-006"], ["TYPE B", 290, "OP-XY · TX-6 (TE gear)"]].map(([t, ox, devs]) => (
        <g key={t}>
          <rect x={ox + 0} y="8" width="14" height="34" rx="3" fill={C.panelUp} stroke={C.line} />
          <rect x={ox + 3} y="42" width="8" height="16" rx="2" fill={C.dim} />
          <rect x={ox + 3} y="14" width="8" height="6" fill={t === "TYPE A" ? C.green : C.amber} />
          <rect x={ox + 3} y="24" width="8" height="6" fill={t === "TYPE A" ? C.amber : C.green} />
          <text x={ox + 24} y="22" fill={C.text} style={mono} fontWeight="700" letterSpacing="1">{t}</text>
          <text x={ox + 24} y="36" fill={C.faint} style={mono}>tip/ring swapped ↕</text>
          <text x={ox} y="76" fill={C.dim} style={mono}>{devs}</text>
        </g>
      ))}
    </svg>
  );
  if (kind === "pressure") return (
    <svg viewBox="0 0 560 96" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      <circle cx="22" cy="46" r="12" fill={C.orange} opacity="0.9" />
      <text x="10" y="78" fill={C.faint} style={mono}>PRESS</text>
      {arrow(40, 30, 92)}{arrow(40, 62, 92)}
      {pill(96, 22, 132, "CHANNELPRESSURE", true, C.green)}
      <text x="96" y="14" fill={C.faint} style={mono}>TRACKING: HIGHEST</text>
      {pill(96, 54, 132, "PRESSURE CC →", true, C.blue)}
      {arrow(234, 30, 268)}{arrow(234, 62, 268)}
      <text x="272" y="32" fill={C.dim} style={mono}>OP-XY · Digitone 2 (native aftertouch)</text>
      <text x="272" y="64" fill={C.dim} style={mono}>OP-1 Field CC1 · M8 CC27 · S-1 CC24 · mGB CC1</text>
    </svg>
  );
  if (kind === "pb") return (
    <svg viewBox="0 0 560 64" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      {pill(0, 10, 120, "ERAE PB RANGE 12", true, C.orange)}
      <text x="136" y="21" fill={C.text} fontSize="13" fontFamily="ui-monospace, monospace">=</text>
      {pill(156, 10, 128, "SYNTH PB RANGE 12", true, C.green)}
      <text x="296" y="21" fill={C.green} style={mono}>✓ slides land in tune</text>
      <text x="0" y="52" fill={C.faint} style={mono}>mismatch → glissando lands off-pitch · fixed range? set IN-TUNE WIDTH 100%</text>
    </svg>
  );
  if (kind === "workflow") return (
    <svg viewBox="0 0 560 44" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      {pill(0, 12, 84, "ERAE LAB", true, C.orange)}{arrow(88, 20, 108)}
      {pill(112, 12, 84, "AUTOSYNC", false)}{arrow(200, 20, 220)}
      {pill(224, 12, 104, "SAVE PROJECT", false)}{arrow(332, 20, 352)}
      {pill(356, 12, 130, "N1–N8 STANDALONE", true, C.green)}
    </svg>
  );
  if (kind === "rk006") return (
    <svg viewBox="0 0 560 70" style={{ width: "100%", maxWidth: 560, height: "auto", marginTop: 10 }}>
      <rect x="0" y="14" width="96" height="40" rx="6" fill={C.panelUp} stroke={C.orange} />
      <text x="12" y="38" fill={C.text} style={mono} fontWeight="700">RK-006</text>
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx={104 + i * 15} cy="34" r="4" fill={i < usedN ? C.orange : C.line} />
      ))}
      <text x="104" y="60" fill={C.faint} style={mono}>{"PER-PORT FILTER: " + (note || "configure per connected device")}</text>
    </svg>
  );
  return null;
}

// ---------- main ----------
export default function EraeMidiMapper() {
  const [presets, setPresets] = useState(() => DEFAULT_RIG_KEYS.map(instantiate));
  const [addOpen, setAddOpen] = useState(false);
  const [armRemove, setArmRemove] = useState(false);
  const [armSwap, setArmSwap] = useState(null);
  const [armReset, setArmReset] = useState(false);
  const [sel, setSel] = useState(0);
  const [view, setView] = useState("preset"); // preset | overview | setup | diagram | export
  const [splitMode, setSplitMode] = useState("rk006"); // rk006 | thrubox | direct
  const [saveState, setSaveState] = useState("idle");
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);
  const saveTimer = useRef(null);

  // load
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(STORAGE_KEY);
        if (r && r.value) {
          const data = JSON.parse(r.value);
          const rigArr = Array.isArray(data) ? data : data.rig;
          if (Array.isArray(rigArr) && rigArr.length >= 1 && rigArr.length <= 8) setPresets(rigArr);
          if (data && data.splitMode) setSplitMode(data.splitMode);
        }
      } catch (e) { /* no saved state yet */ }
      loaded.current = true;
    })();
  }, []);

  // autosave (debounced)
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify({ rig: presets, splitMode }));
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch (e) { setSaveState("error"); }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [presets, splitMode]);

  const p = presets[sel];

  // disarm pending confirmations when the context changes
  useEffect(() => { setArmRemove(false); setArmSwap(null); setArmReset(false); }, [sel, view, addOpen]);

  const portInfo = computePorts(presets, splitMode);
  const collisions = computeCollisions(presets, splitMode, portInfo);
  const collisionsFor = (idx) => collisions.filter((c) => c.devs.some((v) => v.i === idx));
  const unconnected = portInfo.filter((x) => !x.connected).length;

  const updatePreset = useCallback((patch) => {
    setPresets((prev) => prev.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  }, [sel]);

  const updateRow = (rowId, patch) => {
    updatePreset({ mappings: p.mappings.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) });
  };
  const removeRow = (rowId) => updatePreset({ mappings: p.mappings.filter((r) => r.id !== rowId) });
  const addRow = () => updatePreset({ mappings: [...p.mappings, m("New control", "", "fader", "verify")] });
  const cycleConf = (row) => {
    const order = ["solid", "likely", "verify", "custom"];
    const next = order[(order.indexOf(row.conf) + 1) % order.length];
    updateRow(row.id, { conf: next });
  };

  const resetAll = async () => {
    if (!armReset) { setArmReset(true); return; } // first tap arms, second confirms
    const fresh = DEFAULT_RIG_KEYS.map(instantiate);
    setPresets(fresh);
    setSel(0);
    setArmReset(false);
    try { await storage.set(STORAGE_KEY, JSON.stringify({ rig: fresh, splitMode })); } catch (e) {}
  };

  const addDevice = (libKey) => {
    if (presets.length >= 8) {
      if (armSwap !== libKey) { setArmSwap(libKey); return; } // first tap arms, second confirms
      const inst = instantiate(libKey);
      setPresets((prev) => prev.map((x, i) => (i === sel ? inst : x)));
    } else {
      const inst = instantiate(libKey);
      setPresets((prev) => [...prev, inst]);
      setSel(presets.length);
    }
    setArmSwap(null);
    setAddOpen(false);
    setView("preset");
  };

  const removeDevice = () => {
    if (presets.length <= 1) return; // button is disabled in this case
    if (!armRemove) { setArmRemove(true); return; } // first tap arms, second confirms
    setPresets((prev) => prev.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, Math.min(s, presets.length - 2)));
    setArmRemove(false);
  };

  // ---------- exports ----------
  const cheatSheet = () => {
    let out = "# ERAE TOUCH 2 — RIG MAP (CCs verified against manufacturer MIDI references)\n\n";
    out += `Split mode: ${splitMode === "rk006" ? "RK-006" : splitMode === "thrubox" ? "passive thru box" : "Erae direct (3 wired lines)"}\n\n`;
    out += "| Slot | Device | Channel scheme | Port | Connection |\n|---|---|---|---|---|\n";
    presets.forEach((x, i) => { out += `| N${i + 1} | ${x.device} | ${x.channel} | ${portInfo[i].connected ? portInfo[i].port : "NOT CONNECTED"} | ${x.connection} |\n`; });
    if (splitMode !== "direct") {
      out += collisions.length
        ? "\n**Bus collisions:** " + collisions.map((c) => `ch ${fmtChans(c.chans)}: ${c.devs.map((v) => v.d.device).join(" ↔ ")}`).join(" · ") + "\n"
        : "\nNo channel collisions on the shared MIDI A bus.\n";
    } else if (unconnected > 0) {
      out += `\n**Unconnected in direct mode:** ${presets.filter((_, i) => !portInfo[i].connected).map((x) => x.device).join(", ")}\n`;
    }
    presets.forEach((x) => {
      out += `\n## N${presets.indexOf(x) + 1} · ${x.device} — ${x.channel}\n${x.tip}\n_Source: ${x.source || "user"}_\n\n`;
      if (x.expression) {
        out += "**Expression:** " + x.expression.map((e) =>
          `${e.cap}: ${(EXPR[e.status] || EXPR.no).label}${e.note ? ` (${e.note})` : ""}`
        ).join(" · ") + "\n\n";
      }
      out += "| Control | CC / Notes | Erae element | Status | Note |\n|---|---|---|---|---|\n";
      x.mappings.forEach((r) => {
        out += `| ${r.control} | ${r.cc} | ${r.type} | ${CONF[r.conf]?.label || r.conf} | ${r.note || ""} |\n`;
      });
      if (x.eraeSetup) out += "\n**Erae 2 / Erae Lab setup:**\n" + x.eraeSetup.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n";
      if (x.mappings.some((r) => r.type === "button")) out += "_Button elements: trigger-style = Enable On only (Enable Off OFF, or release re-fires); hold = On 127/Off 0 unlatched; toggle = On 127/Off 0 latched._\n";
      if (x.deviceSetup) out += `\n**${x.device} setup:**\n` + x.deviceSetup.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n";
    });
    return out;
  };

  const copySheet = async () => {
    const text = cheatSheet();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erae2-rig-map.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const verifyCount = presets.reduce(
    (n, x) => n + x.mappings.filter((r) => r.conf === "verify").length, 0
  );
  const solidCount = presets.reduce(
    (n, x) => n + x.mappings.filter((r) => r.conf === "solid").length, 0
  );

  // ---------- styles ----------
  const wrap = {
    minHeight: "100vh", background: C.bg, color: C.text,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 13,
    padding: "0 0 48px",
  };
  const monoLabel = {
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 10, letterSpacing: 2, color: C.dim, textTransform: "uppercase",
  };
  const tabBtn = (active) => ({
    background: active ? C.panelUp : "transparent", color: active ? C.text : C.dim,
    border: `1px solid ${active ? C.line : "transparent"}`, borderRadius: 6,
    padding: IS_TOUCH ? "10px 16px" : "6px 14px", cursor: "pointer",
    fontSize: IS_TOUCH ? 14 : 12, letterSpacing: 0.5,
  });

  return (
    <div style={wrap}>
      <style>{`
        button, select, input { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        body { overscroll-behavior-y: none; }
      `}</style>
      {/* header */}
      <div style={{
        borderBottom: `1px solid ${C.line}`, padding: "20px 24px 16px",
        display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12,
      }}>
        <div style={{ marginRight: "auto" }}>
          <div style={{ ...monoLabel, color: C.orange }}>ERAE TOUCH 2 · PRIMARY CONTROLLER</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginTop: 2 }}>
            Rig Map — {presets.length}/8 Layout Slots
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={tabBtn(view === "preset")} onClick={() => setView("preset")}>Slots</button>
          <button style={tabBtn(view === "overview")} onClick={() => setView("overview")}>Channel plan</button>
          <button style={tabBtn(view === "setup")} onClick={() => setView("setup")}>Erae setup</button>
          <button style={tabBtn(view === "diagram")} onClick={() => setView("diagram")}>Diagram</button>
          <button style={tabBtn(view === "export")} onClick={() => setView("export")}>Export</button>
          <span style={{
            ...monoLabel, fontSize: 9, marginLeft: 6,
            color: saveState === "error" ? C.red : saveState === "saved" ? C.green : C.faint,
          }}>
            {saveState === "saving" ? "SAVING…" : saveState === "saved" ? "SAVED" : saveState === "error" ? "SAVE FAILED" : "AUTOSAVE"}
          </span>
        </div>
      </div>

      {/* slot selector — the N1–N8 row */}
      <div style={{ padding: "18px 24px 6px" }}>
        <div style={monoLabel}>N1 – N8 · one slot per instrument · add or remove devices freely</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {presets.map((x, i) => {
            const active = view === "preset" && i === sel;
            const nc = !portInfo[i].connected;
            return (
              <button
                key={x.id}
                onClick={() => { setSel(i); setView("preset"); }}
                style={{
                  width: IS_TOUCH ? 88 : 76, height: IS_TOUCH ? 74 : 64, borderRadius: 8, cursor: "pointer",
                  background: active ? C.panelUp : C.panel,
                  border: `1px solid ${active ? x.color : C.line}`,
                  boxShadow: active ? `0 0 14px ${x.color}44, inset 0 0 0 1px ${x.color}33` : "none",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 5, transition: "all 120ms ease",
                  opacity: nc ? 0.35 : 1,
                }}
                title={nc ? "Not connected in Erae-direct mode — no free port" : undefined}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: nc ? C.faint : x.color,
                  boxShadow: nc ? "none" : `0 0 ${active ? 8 : 3}px ${x.color}`,
                  opacity: active ? 1 : 0.55,
                }} />
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: active ? C.text : C.dim }}>
                  N{i + 1}
                </div>
                <div style={{
                  fontSize: 9, color: active ? C.text : C.faint, maxWidth: 68,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {x.device}
                </div>
              </button>
            );
          })}
          {(
            <button onClick={() => setAddOpen((v) => !v)} title="Add a device to the rig" style={{
              width: IS_TOUCH ? 88 : 76, height: IS_TOUCH ? 74 : 64, borderRadius: 8, cursor: "pointer",
              background: addOpen ? C.panelUp : "transparent",
              border: `1px dashed ${C.orange}77`, color: C.orange,
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 4, fontSize: 20,
            }}>
              +
              <span style={{ fontSize: 8.5, fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}>ADD</span>
            </button>
          )}
        </div>
        {addOpen && (
          <div style={{
            marginTop: 10, background: C.panel, border: `1px solid ${C.line}`,
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ ...monoLabel, fontSize: 9, marginBottom: 10 }}>
              {presets.length < 8
                ? `Device pool — pick one for slot N${presets.length + 1}`
                : `Device pool — rig is full (8/8): picking a device replaces the selected slot, N${sel + 1} · ${p.device}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
              {DEVICE_LIBRARY.map((t) => {
                const armed = armSwap === t.libKey;
                return (
                  <button key={t.libKey} onClick={() => addDevice(t.libKey)} style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    background: armed ? `${C.orange}22` : C.bg,
                    border: `1px solid ${armed ? C.orange : C.line}`, borderRadius: 8,
                    padding: "10px 12px", cursor: "pointer",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, boxShadow: `0 0 5px ${t.color}`, flexShrink: 0 }} />
                    <span>
                      <span style={{ display: "block", color: armed ? C.orange : C.text, fontSize: 12, fontWeight: 600 }}>
                        {armed ? `Tap again — replaces N${sel + 1} · ${p.device}` : t.device}
                      </span>
                      <span style={{ display: "block", color: C.faint, fontSize: 10.5, marginTop: 2 }}>{t.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---------- preset view ---------- */}
      {view === "preset" && (
        <div style={{ padding: "16px 24px 0", maxWidth: 980 }}>
          <div style={{
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10,
            borderTop: `2px solid ${p.color}`, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 200px" }}>
                <div style={monoLabel}>Device</div>
                <Field value={p.device} onChange={(v) => updatePreset({ device: v })} />
              </div>
              <div style={{ flex: "1 1 170px" }}>
                <div style={monoLabel}>Channel scheme</div>
                <Field mono value={String(p.channel)} onChange={(v) => updatePreset({ channel: v })} />
              </div>
              <div style={{ flex: "2 1 240px" }}>
                <div style={monoLabel}>Connection path</div>
                <Field value={p.connection} onChange={(v) => updatePreset({ connection: v })} />
              </div>
              <button onClick={removeDevice} disabled={presets.length <= 1}
                title={presets.length <= 1 ? "The rig needs at least one device" : "Remove this device from the rig"}
                style={{
                  alignSelf: "flex-start",
                  background: armRemove ? C.red : "transparent",
                  color: armRemove ? "#0F0F10" : C.red,
                  border: `1px solid ${C.red}${armRemove ? "" : "44"}`,
                  borderRadius: 6, padding: "6px 10px",
                  cursor: presets.length <= 1 ? "not-allowed" : "pointer",
                  fontSize: 11, whiteSpace: "nowrap",
                  fontWeight: armRemove ? 700 : 400,
                  opacity: presets.length <= 1 ? 0.4 : 1,
                }}>
                {armRemove ? "Tap again to remove" : "× Remove"}
              </button>
            </div>
            <div style={{
              marginTop: 12, padding: "10px 12px", background: C.bg, borderRadius: 6,
              border: `1px solid ${C.line}`, color: C.dim, fontSize: 12, lineHeight: 1.55,
            }}>
              {p.tip}
              {p.source && (
                <div style={{ marginTop: 6, fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: C.faint, letterSpacing: 0.4 }}>
                  SOURCE · {p.source}
                </div>
              )}
            </div>

            {/* expression compatibility */}
            {p.expression && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...monoLabel, fontSize: 9, marginBottom: 8 }}>Expression compatibility</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {p.expression.map((e, i) => {
                    const s = EXPR[e.status] || EXPR.no;
                    return (
                      <div key={i} title={e.note} style={{
                        display: "flex", alignItems: "center", gap: 7,
                        background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6,
                        padding: "6px 10px", minWidth: 0,
                      }}>
                        <span style={{ fontSize: 11, color: C.dim }}>{e.cap}</span>
                        <span style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1,
                          color: s.color, border: `1px solid ${s.color}55`, background: `${s.color}14`,
                          borderRadius: 3, padding: "1px 5px",
                        }}>{s.label}</span>
                        {e.note && <span style={{ fontSize: 10, color: C.faint, maxWidth: 260 }}>{e.note}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* live rig status: port + collisions, computed from current devices */}
            {(() => {
              const info = portInfo[sel];
              const myCols = collisionsFor(sel);
              const onBus = p.route === "bus" && splitMode !== "direct";
              return (
                <div style={{
                  marginTop: 14, padding: "10px 12px", borderRadius: 6,
                  background: C.bg,
                  border: `1px solid ${!info.connected ? C.red : myCols.length ? C.amber : C.line}`,
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: 1.5, color: C.dim }}>
                      RIG STATUS · {splitMode === "rk006" ? "RK-006 SPLIT" : splitMode === "thrubox" ? "THRU BOX" : "ERAE DIRECT"}
                    </span>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: info.connected ? C.orange : C.red }}>
                      {info.connected ? `PORT: ${info.port}` : "NOT CONNECTED — no free port in Erae-direct mode"}
                    </span>
                    {(p.chans || []).length > 0 && info.connected && (
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.dim }}>
                        bus ch {fmtChans(p.chans)}
                      </span>
                    )}
                  </div>
                  {info.connected && onBus && (
                    myCols.length ? (
                      <div style={{ marginTop: 6 }}>
                        {myCols.map((c, i) => (
                          <div key={i} style={{ fontSize: 11, color: C.amber, lineHeight: 1.6 }}>
                            ⚠ ch {fmtChans(c.chans)} shared with {c.devs.filter((v) => v.i !== sel).map((v) => `${v.d.device} (N${v.i + 1})`).join(", ")}
                            {splitMode === "rk006"
                              ? " — resolve with RK-006 per-port filters, or move one device's channels."
                              : " — a passive thru box can't filter; move one device's channels."}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11, color: C.green }}>
                        ✓ No channel collisions on the shared bus with the current rig.
                      </div>
                    )
                  )}
                  {info.connected && !onBus && (
                    <div style={{ marginTop: 6, fontSize: 11, color: C.green }}>
                      ✓ Private line — channel collisions aren't possible on this connection.
                    </div>
                  )}
                  {!info.connected && (
                    <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
                      Erae-direct mode has 3 wired lines (USB Host, MIDI A, MIDI B), assigned in slot order,
                      plus one chained slot per connected MIDI-THRU device (the Digitone 2 has THRU).
                      Move this device earlier, put a THRU-capable device on a line, remove a device, or switch to RK-006 / thru-box mode.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* visual Erae Lab guide */}
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <LabSettingsCard p={p} />
              <LayoutPreview p={p} />
            </div>
            <ElementRecipes p={p} />

            {/* setup steps */}
            {(p.eraeSetup || p.deviceSetup) && (
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
                {p.eraeSetup && (
                  <div style={{ flex: "1 1 300px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 14px" }}>
                    <div style={{ ...monoLabel, fontSize: 9, color: C.orange, marginBottom: 6 }}>On the Erae 2 / Erae Lab</div>
                    <ol style={{ margin: 0, paddingLeft: 18, color: C.dim, fontSize: 11.5, lineHeight: 1.65 }}>
                      {p.eraeSetup.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}
                {p.deviceSetup && (
                  <div style={{ flex: "1 1 300px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 14px" }}>
                    <div style={{ ...monoLabel, fontSize: 9, color: p.color, marginBottom: 6 }}>On the {p.device}</div>
                    <ol style={{ margin: 0, paddingLeft: 18, color: C.dim, fontSize: 11.5, lineHeight: 1.65 }}>
                      {p.deviceSetup.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* mapping table */}
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "minmax(150px,1.4fr) 118px 96px 84px minmax(150px,1.6fr) 30px",
                gap: 4, alignItems: "center", minWidth: 660,
              }}>
                {["Control", "CC / Notes", "Erae element", "Status", "Note", ""].map((h, i) => (
                  <div key={i} style={{ ...monoLabel, fontSize: 9, padding: "0 6px 6px" }}>{h}</div>
                ))}
                {p.mappings.map((r) => (
                  <React.Fragment key={r.id}>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0" }}>
                      <Field value={r.control} onChange={(v) => updateRow(r.id, { control: v })} />
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0" }}>
                      <Field mono center value={r.cc} placeholder="—"
                        onChange={(v) => updateRow(r.id, { cc: v })} />
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0" }}>
                      <select
                        value={r.type}
                        onChange={(e) => updateRow(r.id, { type: e.target.value })}
                        style={{
                          background: C.panel, color: C.dim, border: `1px solid ${C.line}`,
                          borderRadius: 4, padding: IS_TOUCH ? "8px 4px" : "4px 4px",
                          fontSize: IS_TOUCH ? 16 : 11, width: "100%",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {ELEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "6px 0" }}>
                      <ConfBadge conf={r.conf} onCycle={() => cycleConf(r)} />
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0" }}>
                      <Field value={r.note} placeholder="—" onChange={(v) => updateRow(r.id, { note: v })} />
                    </div>
                    <div style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0", textAlign: "center" }}>
                      <button onClick={() => removeRow(r.id)} title="Remove row"
                        style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 14 }}>
                        ×
                      </button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <button onClick={addRow} style={{
              marginTop: 12, background: "transparent", color: C.orange,
              border: `1px dashed ${C.orange}66`, borderRadius: 6, padding: "6px 14px",
              cursor: "pointer", fontSize: 12,
            }}>
              + Add control
            </button>
          </div>
        </div>
      )}

      {/* ---------- overview ---------- */}
      {view === "overview" && (
        <div style={{ padding: "16px 24px 0", maxWidth: 980 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ ...monoLabel, marginBottom: 12 }}>Channel plan — several devices use channel-per-track schemes</div>
            {presets.map((x, i) => (
              <div key={x.id} onClick={() => { setSel(i); setView("preset"); }} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "10px 8px",
                borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: x.color, boxShadow: `0 0 5px ${x.color}` }} />
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.dim, width: 26 }}>N{i + 1}</div>
                <div style={{ fontWeight: 600, width: 118 }}>{x.device}</div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.orange, width: 150 }}>{x.channel}</div>
                <div style={{ color: C.faint, fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {x.connection}
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: portInfo[i].connected ? C.dim : C.red, width: 128, textAlign: "right" }}>
                  {portInfo[i].connected ? portInfo[i].port : "NOT CONNECTED"}
                </div>
                {collisionsFor(i).length > 0 && (
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: C.amber }}>⚠ CH</div>
                )}
                {x.mappings.some((r) => r.conf === "verify") && (
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: C.red }}>
                    {x.mappings.filter((r) => r.conf === "verify").length} VERIFY
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.7 }}>
              {splitMode === "direct" ? (
                <div style={{ color: C.faint }}>
                  <b style={{ color: C.text }}>Erae-direct mode:</b> 3 wired lines (USB Host, MIDI A, MIDI B),
                  assigned in slot order, plus THRU chaining off connected THRU-capable devices (Digitone 2).
                  Direct lines are private; THRU chains share channels within the chain, so any conflicts are flagged above.
                  {unconnected > 0 && (
                    <span style={{ color: C.red }}> {unconnected} device{unconnected === 1 ? "" : "s"} currently unconnected — reorder slots, remove devices, or switch to a splitter mode.</span>
                  )}
                </div>
              ) : collisions.length ? (
                <div>
                  {collisions.map((c, i) => (
                    <div key={i} style={{ color: C.amber }}>
                      ⚠ ch {fmtChans(c.chans)} shared on the MIDI A bus by {c.devs.map((v) => `${v.d.device} (N${v.i + 1})`).join(" ↔ ")}
                      {splitMode === "rk006" ? " — add RK-006 per-port filters or move channels." : " — move one device's channels (no filtering on a passive box)."}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: C.green }}>
                  ✓ No channel collisions on the shared MIDI A bus with the current rig.
                  <span style={{ color: C.faint }}> Bus roster: {presets.filter((d) => d.route === "bus" && (d.chans || []).length).map((d) => `${d.device} ch ${fmtChans(d.chans)}`).join(" · ") || "empty"}.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- global Erae setup guide ---------- */}
      {view === "setup" && (
        <div style={{ padding: "16px 24px 0", maxWidth: 980 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ ...monoLabel, marginBottom: 4 }}>Erae 2 rig setup — from the Embodme Erae 2 manual</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: C.faint, marginBottom: 14 }}>
              SOURCE · embodme.com/manual/erae-2 — ch. 2 (Getting Started), 5 (Elements), 6 (MIDI Configuration)
            </div>

            {[
              {
                h: "1 · Output destinations (the #1 gotcha)", g: "dest",
                body: "Every element defaults to sending on USB Device only — a layout that works in your DAW will be silent to hardware until you enable the right port. In Erae Lab, set each element's MIDI Output Destination to USB Host, MIDI A, or MIDI B (any combination). The Pedal element routes independently too.",
              },
              {
                h: "2 · TRS type — the rig has both kinds", g: "trs",
                body: "Settings > TRS MIDI Type: set MIDI A to Type A — it feeds the RK-006, which is all TRS-A. Cable types are then solved per device at the RK-006's outputs: plain TRS minijack cables for the Type A crowd (M8, MicroFreak, S-1, SP-404), the bundle's TRS A→B dongle for the OP-XY (TE wiring), and a TRS-A→DIN cable for the Digitone 2. With a passive thru box instead, the same logic applies but everything normalizes through DIN.",
              },
              {
                h: "2b · RK-006 extras worth configuring", g: "rk006",
                body: "The RK-006 is more than a splitter: its web-MIDI config tool sets per-port MIDI channel filtering (enforce the bus plan in hardware — e.g. the SP-404 port passes only ch 1–10 + 16, the MicroFreak port only ch 11), per-port clock filtering (keep Erae data and OP-XY clock from colliding), and clock processing. It's USB-powered; with the included OTG dongle it can even host USB MIDI devices — a fallback host for the TX-6 if the Erae's host port acts up. Save the rig as an RK-006 preset so the one-button recalls it.",
              },
              {
                h: "3 · Pressure for a non-MPE rig (this one)", g: "pressure",
                body: "Nothing in this device pool accepts MPE, so keep the MPE toggle OFF on every Keyboard/KeyGrid/Drumpad element. For devices that receive aftertouch (OP-XY, Digitone 2): Expressivity Tune > Pressure → Enable, Type: Channel. For devices with no aftertouch (OP-1 Field, S-1, SP-404, mGB): leave Expressivity Pressure off and instead use the Control Change section's Pressure lane — Enable, Type CC, Controller N — to send pressure as an ordinary CC the device can map (the OP-1 Field's MIDI LFO on CC 1–4 is the showcase).",
              },
              {
                h: "4 · Pitch bend range must match", g: "pb",
                body: "The element's Pitch Bend Range (default 12 semitones) must equal the receiving synth's bend range or slides land off-pitch. Where a device's range is fixed or awkward, set Glissando In-Tune Width to 100% to suppress bend entirely and get clean semitones.",
              },
              {
                h: "5 · The inspector, decoded (exact field paths)",
                body: "Every element: Midi Output toggles (USB Device defaults ON — flip it off and enable your real port), Channel, Trig on entry. Fader1D: Control Change > Y abs → Enable, Type CC, Controller N. Fader2D: same under X abs + Y abs. Keyboard/KeyGrid/Drumpad: MPE toggle (keep OFF), PB Range slider, Expressivity Tune > Pressure (Type: Channel for aftertouch devices) — or send pressure as a CC via Control Change > Pressure lane. Buttons have separate ON and OFF Control Change sends plus Latched: trigger-style buttons need Enable Off turned OFF, or the command fires again on release; hold-style (sustain) wants On 127 / Off 0 unlatched; toggle-style wants the same values with Latched ON. Each preset's recipes section spells this out with its own numbers.",
              },
              {
                h: "6 · Workflow", g: "workflow",
                body: "Erae Lab connects automatically over USB (a vendor interface, not a MIDI port) and autosyncs edits live. Build each preset below as one layout in slots 1–8, name them, then save the project — the Erae 2 runs all 8 standalone from the N1–N8 buttons with no computer. Use Settings > MIDI Monitor on the device to verify channel and CC traffic if a device doesn't respond, and Settings > Routing to merge/thru between ports (saved per project).",
              },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.h}</div>
                <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.65 }}>{s.body}</div>
                {s.g && <SetupGraphic kind={s.g}
                  note={s.g === "rk006" ? (presets.filter((d) => d.route === "bus" && (d.chans || []).length).map((d) => `${d.device.split(" ")[0]}→${fmtChans(d.chans)}`).join(" · ") || undefined) : undefined}
                  used={s.g === "rk006" ? presets.filter((d) => d.route === "bus").length : undefined} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- signal-flow diagram (data-driven) ---------- */}
      {view === "diagram" && (
        <div style={{ padding: "16px 24px 0", maxWidth: 980 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ ...monoLabel, marginRight: "auto" }}>Signal flow — updates as you add / remove devices</div>
              <div style={{ display: "flex", gap: 0, border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
                {[["rk006", "RK-006 split"], ["thrubox", "Passive thru box"], ["direct", "Erae direct"]].map(([k, label]) => (
                  <button key={k} onClick={() => setSplitMode(k)} style={{
                    background: splitMode === k ? C.orange : "transparent",
                    color: splitMode === k ? "#0F0F10" : C.dim,
                    border: "none", padding: "6px 12px", cursor: "pointer",
                    fontSize: 11, fontWeight: splitMode === k ? 700 : 400,
                  }}>{label}</button>
                ))}
              </div>
            </div>
            {(() => {
              const rk = splitMode === "rk006";
              const direct = splitMode === "direct";
              const annotated = presets.map((d, i) => ({ d, i, pi: portInfo[i] }));
              const hostDevs = annotated.filter((x) => !direct && x.d.route === "usbhost");
              const widiDevs = annotated.filter((x) => !direct && x.d.route === "widi");
              const busDevs = annotated.filter((x) => !direct && x.d.route === "bus");
              const dHost = annotated.filter((x) => direct && x.pi.connected && x.pi.port.startsWith("USB Host"));
              const dA = annotated.filter((x) => direct && x.pi.connected && x.pi.port.startsWith("MIDI A"));
              const dB = annotated.filter((x) => direct && x.pi.connected && x.pi.port.startsWith("MIDI B"));
              const dNC = annotated.filter((x) => direct && !x.pi.connected);
              // in direct mode keep chained devices adjacent to their parents
              const dOrder = [...dHost, ...dB, ...dA];
              const withChains = [];
              dOrder.forEach((x) => {
                if (portInfo[x.i].chainParent != null) return; // placed under parent
                withChains.push(x);
                let parent = x.i;
                annotated.forEach((y) => { if (portInfo[y.i].chainParent === parent) { withChains.push(y); parent = y.i; } });
              });
              const rows = direct ? [...withChains, ...dNC] : [...hostDevs, ...widiDevs, ...busDevs];
              const subSplit = (s) => {
                if (!s) return [null, null];
                if (s.length <= 28) return [s, null];
                const parts = s.split(" · ");
                if (parts.length > 1) {
                  const a = parts[0];
                  let b = parts.slice(1).join(" · ");
                  if (b.length > 30) b = b.slice(0, 29) + "…";
                  return [a, b];
                }
                return [s.slice(0, 28), s.slice(28, 57) + (s.length > 57 ? "…" : "")];
              };
              const rowY = (idx) => 100 + idx * 68;
              const H = Math.max(470, rowY(rows.length - 1) + 100);
              const eraeY = Math.max(150, H / 2 - 130);
              const pDev = eraeY + 92, pHost = eraeY + 142, pB = eraeY + 192, pA = eraeY + 242;
              const widiRow = direct ? dB : widiDevs;
              const widiY = widiRow.length ? rowY(rows.indexOf(widiRow[0])) - 8 : 0;
              const busStart = rows.length - busDevs.length;
              const splitY = (!direct && busDevs.length)
                ? Math.min(H - 110, Math.max(pA - 30, rowY(busStart) + ((busDevs.length - 1) * 68) / 2 - 26))
                : 0;
              const box = (x, y, w, h, color, title, sub, sub2, dashed) => (
                <g key={title + y}>
                  <rect x={x} y={y} width={w} height={h} rx="8" fill={C.bg} stroke={color} strokeWidth="1.4"
                    strokeDasharray={dashed ? "4 4" : "none"} />
                  <circle cx={x + 14} cy={y + 15} r="4" fill={color} />
                  <text x={x + 26} y={y + 19} fill={dashed ? C.faint : C.text} fontSize="12.5" fontWeight="700" fontFamily="Inter, sans-serif">{title}</text>
                  {sub && <text x={x + 14} y={y + 35} fill={C.dim} fontSize="9" fontFamily="ui-monospace, monospace">{sub}</text>}
                  {sub2 && <text x={x + 14} y={y + 47} fill={C.faint} fontSize="9" fontFamily="ui-monospace, monospace">{sub2}</text>}
                </g>
              );
              const wire = (x1, y1, x2, y2, color, dashed) => (
                <path key={`w${x1}${y1}${x2}${y2}`} d={`M ${x1} ${y1} C ${x1 + 55} ${y1}, ${x2 - 55} ${y2}, ${x2} ${y2}`}
                  fill="none" stroke={color} strokeWidth="1.6"
                  strokeDasharray={dashed ? "5 5" : "none"} opacity="0.85" />
              );
              const portLabel = (x, y, text, color) => (
                <text key={text + y} x={x} y={y} fill={color || C.dim} fontSize="9.5" letterSpacing="1"
                  fontFamily="ui-monospace, monospace">{text}</text>
              );
              const hostOn = direct ? dHost.length > 0 : hostDevs.length > 0;
              const bOn = direct ? dB.length > 0 : widiDevs.length > 0;
              const aOn = direct ? dA.length > 0 : busDevs.length > 0;
              return (
                <svg viewBox={`0 0 860 ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                  <rect x="20" y={eraeY} width="150" height="260" rx="10" fill={C.panelUp} stroke={C.orange} strokeWidth="1.6" />
                  <text x="46" y={eraeY + 32} fill={C.text} fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif">ERAE 2</text>
                  <text x="46" y={eraeY + 48} fill={C.faint} fontSize="9.5" fontFamily="ui-monospace, monospace">PRIMARY CONTROLLER</text>
                  {portLabel(46, pDev + 4, "USB DEVICE", C.faint)}
                  {portLabel(46, pHost + 4, "USB HOST", hostOn ? (direct ? dHost[0].d.color : hostDevs[0].d.color) : C.faint)}
                  {portLabel(46, pB + 4, "MIDI B · TRS", bOn ? (direct ? dB[0].d.color : widiDevs[0].d.color) : C.faint)}
                  {portLabel(46, pA + 4, direct ? "MIDI A · TRS" : rk ? "MIDI A · TRS-A" : "MIDI A · TRS", aOn ? (direct ? dA[0].d.color : C.orange) : C.faint)}
                  {[pDev, pHost, pB, pA].map((y) => (
                    <circle key={y} cx="170" cy={y} r="4" fill={C.bg} stroke={C.line} strokeWidth="1.2" />
                  ))}

                  {wire(174, pDev, 300, 46, C.faint, true)}
                  {box(300, 20, 190, 52, C.faint, "Computer / DAW", "optional · Erae Lab autosync", "MPE cable lives here too")}

                  {/* splitter modes: WIDI + splitter nodes */}
                  {!direct && widiDevs.length > 0 && box(300, widiY, 130, 48, widiDevs[0].d.color, "WIDI", "BLE bridge")}
                  {!direct && widiDevs.length > 0 && wire(174, pB, 300, widiY + 24, widiDevs[0].d.color)}
                  {!direct && busDevs.length > 0 && (rk
                    ? box(300, splitY, 130, 62, C.orange, "RK-006", `${busDevs.length}-of-10 outs · TRS-A`, "per-port ch filter · USB pwr")
                    : box(300, splitY, 130, 52, C.orange, "MIDI thru", `1-in / ${Math.max(busDevs.length, 4)}-out box`, "normalizes to DIN"))}
                  {!direct && busDevs.length > 0 && wire(174, pA, 300, splitY + 28, C.orange)}

                  {/* direct mode: WIDI inline on its port if the widi device got a line */}
                  {direct && dB.length > 0 && dB[0].d.route === "widi" && box(300, widiY, 130, 48, dB[0].d.color, "WIDI", "BLE bridge")}
                  {direct && dB.length > 0 && dB[0].d.route === "widi" && wire(174, pB, 300, widiY + 24, dB[0].d.color)}

                  {rows.map((x, idx) => {
                    const y = rowY(idx);
                    const nc = direct && !x.pi.connected;
                    const chained = direct && x.pi.chainParent != null;
                    const rawSub = nc ? "no free port · chain via THRU or use a splitter"
                      : direct ? `${x.pi.port} · ${x.d.channel.replace(/\s*\(bus.*?\)/, "")}`
                      : (x.d.diagSub ? (rk ? x.d.diagSub.rk : x.d.diagSub.thru) : x.d.channel);
                    const [sub, sub2] = subSplit(rawSub);
                    const parentRow = chained ? rows.findIndex((r) => r.i === x.pi.chainParent) : -1;
                    return (
                      <g key={x.d.id}>
                        {!direct && x.d.route === "usbhost" && wire(174, pHost, 628, y + 26, x.d.color)}
                        {!direct && x.d.route === "widi" && (
                          <>
                            {wire(430, widiY + 24, 628, y + 26, x.d.color, true)}
                            <text x="505" y={(widiY + y) / 2 + 18} fill={x.d.color} fontSize="9.5"
                              fontFamily="ui-monospace, monospace" opacity="0.8">bluetooth le ~</text>
                          </>
                        )}
                        {!direct && x.d.route === "bus" && wire(430, splitY + 28 + Math.min(idx - busStart, 5) * 5, 628, y + 26, x.d.color)}
                        {direct && x.pi.connected && !chained && x.d.route !== "widi" &&
                          wire(174, x.pi.port.startsWith("USB Host") ? pHost : x.pi.port.startsWith("MIDI A") ? pA : pB, 628, y + 26, x.d.color)}
                        {chained && parentRow >= 0 && (
                          <>
                            <path d={`M ${628 + 12} ${rowY(parentRow) + 52} C ${628 - 14} ${rowY(parentRow) + 62}, ${628 - 14} ${y + 8}, ${628 + 12} ${y + 14}`}
                              fill="none" stroke={x.d.color} strokeWidth="1.6" opacity="0.85" />
                            <text x={596} y={(rowY(parentRow) + 52 + y) / 2 + 6} fill={x.d.color} fontSize="8.5"
                              fontFamily="ui-monospace, monospace" opacity="0.9">THRU</text>
                          </>
                        )}
                        {direct && x.pi.connected && x.d.route === "widi" && (
                          <>
                            {wire(430, widiY + 24, 628, y + 26, x.d.color, true)}
                            <text x="505" y={(widiY + y) / 2 + 18} fill={x.d.color} fontSize="9.5"
                              fontFamily="ui-monospace, monospace" opacity="0.8">bluetooth le ~</text>
                          </>
                        )}
                        {box(628, y, 218, 52, nc ? C.faint : x.d.color,
                          `${x.d.device.length > 16 ? x.d.device.slice(0, 15) + "…" : x.d.device} · N${x.i + 1}`, sub, sub2, nc)}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
            <div style={{ marginTop: 10, color: C.faint, fontSize: 11, lineHeight: 1.6 }}>
              {splitMode === "rk006"
                ? "Solid lines are cables; dashed lines are wireless or optional. The RK-006 (up to 10 outs) takes the Erae's MIDI A output — set that jack to Type A — and each bus device connects with the cable named on its box. Configure per-port channel filters in the RK-006 web tool to enforce the channel plan."
                : splitMode === "thrubox"
                ? "Solid lines are cables; dashed lines are wireless or optional. A passive thru box fans the Erae's MIDI A out as DIN — each device needs a DIN cable of its own TRS type. No filtering: the channel plan lives entirely in device settings."
                : "Erae-direct: no splitter — just the Erae's own three lines (USB Host, MIDI A, MIDI B), assigned in slot order, extended by MIDI-THRU chaining where hardware allows it (the Digitone 2's THRU jack passes its input onward, adding one chained slot). Direct lines are private; a THRU chain shares channels between its members, so collision checks apply per chain. Greyed boxes didn't get a port. Both TRS jacks share the global TRS Type setting — pick same-type devices for A and B or keep a crossover adapter handy."}
            </div>
          </div>
        </div>
      )}

      {/* ---------- export ---------- */}
      {view === "export" && (
        <div style={{ padding: "16px 24px 0", maxWidth: 980 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ ...monoLabel, marginBottom: 12 }}>Take the map with you</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={copySheet} style={{
                background: C.orange, color: "#0F0F10", border: "none", borderRadius: 6,
                padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 12,
              }}>
                {copied ? "Copied ✓" : "Copy cheat sheet (Markdown)"}
              </button>
              <button onClick={downloadJSON} style={{
                background: "transparent", color: C.text, border: `1px solid ${C.line}`,
                borderRadius: 6, padding: "9px 18px", cursor: "pointer", fontSize: 12,
              }}>
                Download JSON backup
              </button>
              <button onClick={resetAll} style={{
                background: armReset ? C.red : "transparent",
                color: armReset ? "#0F0F10" : C.red,
                border: `1px solid ${C.red}${armReset ? "" : "44"}`,
                borderRadius: 6, padding: "9px 18px", cursor: "pointer", fontSize: 12,
                fontWeight: armReset ? 700 : 400,
              }}>
                {armReset ? "Tap again — wipes all edits" : "Reset to verified defaults"}
              </button>
            </div>
            <pre style={{
              marginTop: 16, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: 14, fontSize: 10.5, lineHeight: 1.5, color: C.dim,
              maxHeight: 380, overflow: "auto", whiteSpace: "pre-wrap",
            }}>
              {cheatSheet()}
            </pre>
          </div>
        </div>
      )}

      {/* footer status */}
      <div style={{ padding: "14px 24px 0", maxWidth: 980 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: C.faint, lineHeight: 1.7 }}>
          {solidCount} mappings verified against manufacturer MIDI references
          {verifyCount > 0 ? ` · ${verifyCount} still marked VERIFY` : " · nothing left to verify"}.
          {" "}M8 lanes are USER-SET by design — bind them in its MIDI Mapping View. Edits autosave to this artifact.
        </div>
      </div>
    </div>
  );
}
