# Erae 2 Rig Map

A MIDI rig planner and configuration guide for the [Embodme Erae Touch 2](https://www.embodme.com)
as primary controller for a hardware synth rig (OP-XY, OP-1 Field, Digitone 2, Dirtywave M8,
MicroFreak, Roland S-1, SP-404 MKII, TX-6, Game Boy/mGB via Arduinoboy).

Features:
- 8 layout slots (N1–N8) with per-device MIDI mappings, verified against manufacturer
  MIDI references and midi.guide
- Live channel-collision detection across the shared MIDI bus
- Three routing modes — RK-006 split, passive thru box, Erae-direct (with MIDI THRU chaining)
- Auto-generated signal-flow diagram
- Erae Lab configuration recipes matching the real inspector fields
- Expression compatibility matrix (velocity / pressure / pitch bend / MPE) per device
- Markdown cheat-sheet + JSON export; edits persist in localStorage
- Installable as a PWA on iPad (Add to Home Screen)

## Develop
```bash
npm install
npm run dev     # http://127.0.0.1:8080
```

## Deploy (GitHub Pages)
1. Push this repo to GitHub (public repo, or private with Pages on a paid plan).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Push to `main` — the workflow builds and deploys automatically.
4. Your app lives at `https://<user>.github.io/<repo>/`. On iPad: open in Safari →
   Share → **Add to Home Screen**.

Note: edits are stored in the browser's localStorage, per device/browser. Use the
Export tab's JSON backup to move data between machines.
