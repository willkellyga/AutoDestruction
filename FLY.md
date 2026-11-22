# Auto Destruction online, on Fly.io

`derby/server/server.mjs` hands out the game page and runs the lobby and the round relay (`derby/server/relay.mjs`,
copied from Monster Mayhem's `playtest/relay.mjs` and changed for cars). `Dockerfile` builds the page and the server;
`fly.toml` runs it on one always-on machine (shared-cpu-1x, 256 MB, region iad): about $2 a month plus a little for
traffic. It is an app of its own, so deploying it never touches Monster Mayhem's.

## Once: the app (on the Mac, in Terminal)

The Fly.io account and card are already set up for Monster Mayhem. Get the repo and create the app without deploying
yet. Pick a name nobody else on Fly.io has, because it becomes the address:

    git clone https://github.com/willkellyga/AutoDestruction.git
    cd AutoDestruction
    fly launch --copy-config --no-deploy --name <app name> --region iad

If it asks "Do you want to tweak these settings before proceeding?", answer **No**. It writes the name into
`fly.toml`; commit that change so later deploys use it.

## Each deploy (in the repo's folder, after `git pull`)

    fly deploy --ha=false

`--ha=false` matters: the rooms live in the server's memory, so there must be exactly one machine. When it finishes,
players open `https://<app name>.fly.dev`. On the start card, under Start: a name, **Play online** (a room for the mode
on the card: a 10 second countdown from the first player in, bots in every empty seat) and **With friends** (a room with
a four-letter code and a Copy link button; the host picks the mode and taps Start). A friend types the code and taps
Join, or opens the link.

Checks: `fly status` should show one machine, started, with a passing check. `fly logs` shows each round and, every
minute while anyone is on, a line with the rooms, players and traffic. `/stats` gives the same counts. If it ever shows
two machines, `fly scale count 1`.

To pause: `fly scale count 0` (and `1` to bring it back). To stop paying: `fly apps destroy <app name>`.

## Trying it at home first

    npm install
    npm run build && npm start

then open http://localhost:8080 in two browsers (or one normal window and one private one: each is its own player).
`npm test` checks the lobby and the relay without a browser.

A copy of the page served from somewhere else (CrazyGames, say) can still play online: build it with
`AD_SERVER=wss://<app name>.fly.dev/ws node derby/build.mjs`, or open it with `?server=wss://<app name>.fly.dev`.
