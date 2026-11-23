# Auto Destruction

A car combat game: build a gun car in the garage, then race through New York, hold a base against a zombie horde, or
fight a free-for-all in the arena. Every mode plays online, with bots in the seats nobody fills.

- **Play it:** `npm install`, then `npm run build`, and open `derby/dist/auto-destruction.html`. It is one
  self-contained file.
- **Online:** `npm start` serves the game and the lobby at http://localhost:8080 (the copy in `derby/dist/web`: the
  page, with its sounds as separate files that browsers keep for a year). `FLY.md` puts it on Fly.io.
- **How it works:** `derby/README.md` covers the controls, modes, garage, parts, online play and every file.

## Where things are

- `derby/`: the game itself (`derby/src`), its sounds (`derby/assets`), the build (`derby/build.mjs`) and the online
  server (`derby/server`).
- `src/`, `units/`, `civilian/`, `assets/sfx/`: the parts of Monster Mayhem's engine the game is built on (the town and
  New York, the destruction, the gun effects, the townsfolk and the sound mixer). They are copied from
  [Monster Mayhem](https://github.com/willkellyga/MonsterMayhem) as they are, only the files the game uses, with their
  history, and the game imports them by relative path. Change them there first and copy them across, so the two stay
  the same.
- `Dockerfile`, `fly.toml`, `FLY.md`: the online server on Fly.io.
- `LICENSES.md`: where everything from outside the project came from.

This repository was split out of Monster Mayhem's `derby/` folder on 2026-11-22, keeping its history.
