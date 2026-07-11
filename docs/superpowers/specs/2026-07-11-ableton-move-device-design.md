# Ableton Move device template — design

Add the Ableton Move to the Erae 2 Rig Map as a first-class device template
in the library palette only. The default rig is unchanged — the TX-6 keeps
the USB Host port; users swap the Move in themselves.

## Sources

- Ableton Move manual §4.1.3 "Connecting MIDI Devices" + §2.1.7 (Setup > MIDI)
  — https://www.ableton.com/en/move/manual/
- Move release notes — https://www.ableton.com/en/release-notes/move-1/
  (1.2.0 clock out; 1.3.0 poly-AT send; 1.5.0 per-track MIDI channels + Auto;
  1.7.0 USB-C MIDI device mode toward external USB hosts)
- Ableton help article "Using MIDI with Move" (per-track channel workflow, Auto semantics)

## MIDI facts the template encodes

- **USB only.** No DIN/TRS, and no Bluetooth (Move's wireless is Wi-Fi/Link
  only — verified against Ableton's tech specs). Route: `usbhost` — Erae 2
  USB Host → Move USB-C (requires Move ≥ 1.7, Standalone Mode). Move runs on
  its own battery/PSU; the host link is data. Since the default rig's TX-6
  also occupies the host port, the template's setup notes say: share the
  port through a powered USB hub, or swap the TX-6 out.
- **Notes + poly aftertouch only.** Manual: "Move can receive polyphonic
  aftertouch messages; monophonic aftertouch, MIDI CC, and MIDI mapping are
  not supported." No CC control, no program change. Conf: solid.
- **Per-track MIDI In/Out channels** (1.5.0+), configured per track via
  Shift + track button → wheel. **Recommended plan: Auto on all four tracks**
  (user decision) — incoming MIDI lands on the currently selected track;
  channel numbers don't matter on the private host-port space.
- **Clock:** Move sends MIDI clock while receiving notes (1.2.0). Clock
  receive: mark `likely` (1.5-era release notes), verify on hardware.
- **Pitch bend receive:** not documented either way — mark `verify`.
- **Gotchas (documented in tip/deviceSetup):** MIDI I/O disabled in Control
  Live Mode; hi-speed USB devices unsupported on Move's own USB-A.

## Template shape (follows existing conventions)

One new entry in `DEVICE_LIBRARY` (`libKey: "ableton_move"`), modeled on the
TX-6 (the other usbhost device): `chans: []` (off-bus, no collision math),
`thru` absent, `diagSub` labels "USB Host · Move USB-C · Auto ch".

- `expression`: velocity **yes** (solid); pressure **yes — polyphonic**
  (solid; the headline pairing — Erae 2 per-note pressure → Move poly AT);
  pitch bend **verify**; MPE **no** (Move is not MPE; poly AT ≠ MPE).
- `mappings` (honest notes-only table): Pads/keys → selected track (notes,
  solid); Poly aftertouch per note (solid); Drum-track notes (verify —
  pad-to-note layout undocumented); MIDI clock out (solid, informational).
  No CC/PC rows — the conf vocabulary (solid/likely/verify/custom) has no
  "unsupported" value, and a row would read as a suggested mapping. The
  CC/PC-unsupported fact lives in `tip`, `expression` notes, and `eraeSetup`.
- `eraeSetup`: one Keys element (any channel, Auto plan) with
  Expressivity > Pressure → **Polyphonic**; optional second element as a
  drum grid for Move's drum track; Output Destination: **USB HOST**;
  hub note for TX-6 coexistence.
- `deviceSetup`: update to ≥ 1.7; Setup > MIDI; per-track MIDI In = Auto via
  Shift + track → wheel; exit Control Live Mode for standalone MIDI.
- `tip`: notes-only reality + poly-AT strength + "channel doesn't pick the
  track — Move's selected track does (Auto)".
- `source` field cites manual §4.1.3 + release notes 1.5/1.7.

## Rig defaults & versioning

- `DEFAULT_RIG_KEYS`: unchanged. Move appears in the Add/Swap palette,
  inserted before the `custom` entry in `DEVICE_LIBRARY`.
- **Bump `STORAGE_KEY` v9 → v10** (per CLAUDE.md's "Adding a device" rule —
  template data changed).

## Testing

`npm run check` (bundle check); `npm run dev` smoke: add/swap Move, confirm
RIG STATUS shows no collisions, diagram draws Move on the USB Host row,
export includes the new device.
