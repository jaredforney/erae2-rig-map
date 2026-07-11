# Erae 2 Rig Map — project context for Claude Code

Single-page React app: MIDI rig planner for an Embodme Erae Touch 2 controlling a
hardware synth rig. One file of app code, no framework beyond React + esbuild.

## Commands
- `npm run dev` — esbuild dev server at http://127.0.0.1:8080 (rebuilds on reload)
- `npm run build` — production build to `dist/` (what CI deploys)
- `npm run check` — fast syntax/bundle check without output

## Layout
- `src/app.jsx` — the entire app (~1500 lines). Deliberately one file.
- `src/entry.jsx` — React mount point.
- `public/` — HTML shell, PWA manifest, home-screen icon. Copied into `dist/` verbatim.
- `scripts/build.mjs` — esbuild production build.
- `.github/workflows/deploy.yml` — builds and deploys `dist/` to GitHub Pages on push to main.

## Architecture (src/app.jsx, top to bottom)
1. `C` — color palette; `CONF`/`EXPR` — status badge definitions.
2. `storage` — localStorage shim (async get/set, get THROWS on missing key).
3. `DEVICE_LIBRARY` — array of device templates. Each has: `libKey`, `chans` (bus
   channel numbers, used for collision math), `route` ("bus" | "usbhost" | "widi"),
   `thru` (true = hardware MIDI THRU, enables chaining in direct mode), `diagSub`
   (diagram cable labels per split mode), `lab` (Erae Lab inspector values),
   `expression`, `mappings`, `eraeSetup`, `deviceSetup`, `tip`, `source`.
4. Topology helpers: `computePorts` (port assignment incl. THRU chaining in direct
   mode), `computeCollisions` (per-bus or per-chain overlap detection), `fmtChans`.
5. Visual components: `LabSettingsCard`, `LayoutPreview` (derived from mappings),
   `ElementRecipes` (exact Erae Lab inspector paths), `SetupGraphic`, `DestPills`.
6. `EraeMidiMapper` — main component. Views: preset | overview | setup | diagram | export.

## Conventions that matter
- **STORAGE_KEY versioning**: saved state overrides `DEVICE_LIBRARY` defaults. Any
  change to default template data MUST bump the version suffix (currently
  `erae2-midi-map-v9`) or users never see the new defaults. UI-only changes don't bump.
- **No browser dialogs**: `window.confirm`/`alert` are blocked in some embeddings.
  Destructive actions use the armed two-tap pattern (`armRemove`, `armSwap`, `armReset`).
- **Touch**: `IS_TOUCH` (pointer: coarse) bumps tap targets; inputs are 16px on touch
  to prevent iOS focus-zoom. Preserve this on any new inputs.
- **All CC/channel data is source-cited** in each template's `source` field. New device
  data should come from the manufacturer's MIDI implementation or midi.guide, marked
  with `conf` levels: solid | likely | verify | custom.
- **Collision logic is data-driven** via `chans` arrays — never hardcode collision
  text in tips; the RIG STATUS block computes it.
- Max 8 rig slots (Erae 2 hardware limit, N1–N8). Slot numbers are index-derived.

## Adding a device
Add a template to `DEVICE_LIBRARY` (copy the Game Boy entry as the fullest example),
set `chans`/`route`/`lab`, bump STORAGE_KEY, `npm run check`.
