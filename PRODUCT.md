# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual players who want a quick, satisfying run. Phones and desktop are weighted equally:

- On phones, the game is usually installed to the home screen and played in portrait, steering with a thumb drag. Sessions are short, sometimes with the sound off, so haptics matter.
- On desktop, it runs in a landscape browser window and is played with the keyboard (A/D or arrows; Up/Space rows a power stroke, and holding it keeps rowing).

The job: pick it up, row until you crash, try again right away, and beat your best.

## Product Purpose

Fox & Floe is a small endless river game. A fox rows a boat down an icy river, dodging floes, icebergs and penguins that hop in and porpoise across its bow, and scoops up fish for points. Success means a run feels good within its first seconds, hazards stay readable at full speed, and every crash leads straight into "one more go".

## Positioning

The cast was hand-built and rigged in Blender, and every motion is a real Blender clip: the fox's rowing cycle, the scarf, and the penguins' idle, crouch and flipper strokes (their leaps and porpoising are ballistic, on top of those clips). The river runs through a full day-to-night cycle every 1000 m. The whole game is self-contained and installable, and it plays offline.

## Operating Context

- Runs last from one to five minutes, and players replay them back to back.
- A run starts with a single tap or keypress, both from the title screen and after a crash.
- After the first visit, the game is served entirely from the service worker cache.
- Static hosting on Vercel (project `fox-floe`), deployed with the Vercel CLI.

## Capabilities and Constraints

- Rules (preserved, except the penguin ambush, reworked on request 2026-09-24, and side currents, removed on request 2026-09-24 because an unasked-for sideways push read as a steering bug): hitting a floe, iceberg, or a penguin that is out of the water ends the run. Fish are worth 25 points each, and fish chains raise a multiplier up to x5. A close call is worth +8. Score = meters + bonus. The river speeds up and gets denser over time.
- Power-ups: the thermos shield smashes through one hit, the golden fish is an 8-second fish magnet, and the driftwood ramp launches the boat over a floe line.
- River sections: calm water, narrows and rapids (side currents removed 2026-09-24).
- Controls: steer with A/D, the arrows, or a mouse/touch drag measured from where the finger lands, not from the middle of the screen (changed on request 2026-09-25). Start or row a power stroke with Up, Space or Enter, or a tap; holding Space or Up keeps rowing (added on request 2026-09-24). M mutes, P pauses, R restarts.
- Stack: static site with vanilla ES modules and no build step. Three.js r164 is vendored in `vendor/`. Pages must be served over http.
- **Hard rule: fully offline.** No web fonts, CDNs or remote files. Everything ships in the project folder.
- `assets.glb` may be restyled at runtime or extended. Keeping it untouched is not required.
- Scope of the current redesign: look, feel and UI (rendering, world, HUD and menus, camera, effects, audio). Rules, controls, characters and difficulty tuning stay as they are.

## Brand Commitments

- Name: Fox & Floe. Tagline: "row the icy rapids".
- The cast is the brand: the fox rowing a wooden boat with a red oar and a scarf, the penguins with their "wek wek" ambush, and schools of fish.
- Voice: short, playful, lowercase hints (for example "drag to steer · tap to row", "hold space to row"), and quiet one-word calls for events (rapids, smash, bonk, air) in the same thin drawn type
- Interface (user preference, 2026-09-23): a normal, minimal game UI in the vein of Alto's Odyssey. The graphics lead: thin type floating over a full-screen river, with no device frame or handheld styling. The user rejected the "pocket LCD handheld" treatment and wants the in-game graphics to carry the redesign.

## Evidence on Hand

- `assets.glb`: all models and animation clips (FoxRow, ScarfWave, PengIdle/PengCrouch/PengFly, TitleCamMove).
- `render.png`: hero render. `icon-192.png` and `icon-512.png`: app icons.
- `sfx/`: CC0 sound effects, with credits in `sfx/CREDITS.md`.
- `blender/foxfloe.blend`: the Blender source.
- The game has no accounts, online leaderboards, multiplayer or purchases. Nothing may imply them.

## Product Principles

1. Readable at speed: a player should be able to read every hazard and pickup at a glance at 20+ m/s.
2. Instant replay: one tap takes you from a crash back to rowing.
3. Pocket-sized: it loads fast, installs, and works fully offline.
4. The cast leads: the fox, the penguins and the fish are the stars, and the world frames them.
5. Two first-class ways to play: portrait with a thumb and landscape with a keyboard.
