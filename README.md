[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/itzalisha99/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/itzalisha99/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# SKYHAWK — Island Courier

A 3D flight game that plays offline in a desktop browser. Fly a little prop
plane around a seeded island: thread glowing rings, land back on the strip,
and keep the tank full while a storm pushes you around.

## Play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and fly with the keyboard:

- **W / S** — throttle up / down
- **Arrow keys** — pitch and roll (bank to turn; banked turns bite harder)
- **A / D** — rudder
- **1 / 2 / 3** — missions: Ring Run (8 rings), Runway Touch (take off, fly the
  circuit, land back on the strip), Storm Courier (5 rings + fuel cans)
- **C** — chase / nose camera, **P** — pause, **R** — restart, **M** — mute

## What is in the game

- An arcade flight model with stalls, banked turns, wind gusts, fuel burn and
  a hard-landing rule: touch down gently, slowly and level on the strip, or
  bounce off the grass and try again.
- A seeded island with hills, beaches, palms, drifting clouds, a sun and a
  sea, built from primitives in three.js (vendored under `game/vendor/`).
- A full HUD: attitude ball, compass strip, altitude, airspeed, heading,
  vertical speed, fuel and throttle bars, mission objective, timer and score.
- Procedural WebAudio sound (engine, wind, ring chimes, crash thud) — no
  audio files, no network requests. Every file the game loads lives under
  `game/`.

## Files

- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored make.fun library. It first checks the
  entry against the bounty gate's own caps (game size, screenshot size and
  dimensions) and fails with a plain message when one is missed.
- `game/index.html` — the page, HUD and import map.
- `game/src/` — one file per job: `config.js` (tuning), `flight.js` (the
  flight model), `terrain.js` (island, sea, runway, palms, clouds),
  `aircraft.js` (the prop plane), `rings.js` (checkpoint rings),
  `missions.js` (three sorties), `effects.js` (smoke, bursts, fuel cans),
  `hud.js` (instruments), `audio.js` (procedural sound), `input.js`
  (keyboard and mouse), `main.js` (boot, loop, cameras, photo hooks).
- `screenshots/` — four real renders of the game in a browser (cover first).
