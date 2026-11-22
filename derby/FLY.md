# Auto Destruction online, on Fly.io

`derby/server/server.mjs` hands out the game page and runs the lobby and the round relay (`derby/server/relay.mjs`,
copied from Monster Mayhem's `playtest/relay.mjs` and changed for cars). `derby/Dockerfile` builds the page and the
server; `derby/fly.toml` runs it on one always-on machine (shared-cpu-1x, 256 MB, region iad), the same size as
Monster Mayhem's playtest server: about $2 a month plus a little for traffic. It is an app of its own, so deploying it
never touches Monster Mayhem's.

## Once: the app (on the Mac, in Terminal, in the game's folder after `git pull`)

The Fly.io account and card are already set up for Monster Mayhem (`playtest/FLY.md`). Pick a name nobody else on
Fly.io has (it becomes the address) and create the app without deploying yet:

    fly launch --config derby/fly.toml --dockerfile derby/Dockerfile --copy-config --no-deploy --name auto-destruction-<something> --region iad

If it asks "Do you want to tweak these settings before proceeding?", answer **No**. It writes the name into
`derby/fly.toml`; that change can be committed.

## Each deploy (from the repo's root)

    fly deploy --config derby/fly.toml --dockerfile derby/Dockerfile --ha=false

`--ha=false` matters: the rooms live in the server's memory, so there must be exactly one machine. When it finishes,
players open `https://<app name>.fly.dev`. On the start card, under Start: a name, **Play online** (a room for the mode
on the card: a 10 second countdown from the first player in, bots in every empty seat) and **With friends** (a room with
a four-letter code and a Copy link button; the host picks the mode and taps Start). A friend types the code and taps
Join, or opens the link.

Checks: `fly status -c derby/fly.toml` should show one machine, started, with a passing check. `fly logs -c derby/fly.toml`
shows each round and, every minute while anyone is on, a line with the rooms, players and traffic. `/stats` gives the
same counts. If it ever shows two machines, `fly scale count 1 -c derby/fly.toml`.

To pause: `fly scale count 0 -c derby/fly.toml` (and `1` to bring it back). To stop paying: `fly apps destroy <app name>`.

## Trying it at home first

    node derby/build.mjs && node derby/server/server.mjs

then open http://localhost:8080 in two browsers (or one normal window and one private one: each is its own player).
`node derby/server/test.mjs` checks the lobby and the relay without a browser.

A copy of the page served from somewhere else (CrazyGames, say) can still play online: build it with
`AD_SERVER=wss://<app name>.fly.dev/ws node derby/build.mjs`, or open it with `?server=wss://<app name>.fly.dev`.
