# Capital Monopoly

A Monopoly-style board game that runs in a browser with no build step, no
bundler and no install. One HTML file, one folder of sounds. Open it and play.

It has a 2D board, a real 3D board, bots you can actually play against, and
multiplayer over the network.

<!-- Screenshots: add yours here. Two files, side by side:
     ![2D board](docs/screenshot-2d.png)
     ![3D board](docs/screenshot-3d.png) -->

## Play it

Clone, then open the file:

```bash
git clone https://github.com/abukloun/Capital_Monopoly.git
open Capital_Monopoly/html_version/index.html
```

`index.html` runs straight from the filesystem. There is nothing to build and
nothing to install. If you prefer a server, any static one will do:

```bash
cd html_version && python3 -m http.server 8000
```

The 3D board loads three.js from a CDN the first time you switch to it, so that
one mode needs a network connection. If it cannot load, the game stays in 2D
and nothing breaks.

## What is in it

**Play against bots** — 2 to 8 players, eight bot personalities that behave
differently rather than just picking differently:

| | | |
|---|---|---|
| Anna · Investor | Mark · Aggressor | Irina · Strategist |
| Oleg · Trader | Elena · Conservative | Timur · Builder |
| Sofia · Rail Strategist | Victor · Deal Maker | |

They hold cash back, chase monopolies, bid up properties they need, and go for
rail sets.

**Multiplayer** — create a room, share the 6-character code, or join by one.
Runs on Supabase realtime, so it works across devices and browsers. A refresh
does not lose your seat: the same tab rejoins the room and the host restores
the last state.

**2D and 3D** — the same game, the same rules, the same turn system and the
same multiplayer sync in both. The 2D/3D button in the top bar switches
renderers at any time, including mid-game. In 3D you can drag to orbit, scroll
or pinch to zoom, and click a tile to open the same property window.

**Trading** — with bots, open Trade on your turn before rolling. In multiplayer
you can offer properties and cash to another player, the host approves, and the
target accepts or declines.

**Two languages** — English and Russian, switchable from the main menu.

## Controls

| | |
|---|---|
| `Space` or `R` | roll the dice |
| `P` | pause / resume (the game also pauses when the tab is hidden) |
| `Esc` | close a property window — trade offers must be accepted or declined |

Clicking a property on the board, or its coloured chip in the players panel,
opens the build / sell / mortgage menu.

## Sound

Music and sound effects have separate volume controls, both on a perceptual
fader, and both remember your last choice.

Browsers refuse to autoplay audio before you interact with the page, so the
theme starts on your first click anywhere. That is the browser's rule, not
something the page can work around.

## Saving

Single-player games save automatically at the start of every turn, and when you
press Save. Pick up where you left off with "Continue game" on the main menu.
Multiplayer hides Save, since the host owns the state.

## Deploying

The repo is set up for [Vercel](https://vercel.com) — `vercel.json` points at
`html_version/` and adds cache headers. Any static host works just as well: set
the publish directory to `html_version`.

## How it is built

One `index.html` holds the whole game — markup, styles, engine and renderer.
No dependencies are vendored; the only external fetch is three.js from a CDN,
and the game runs fine without it.

That is a deliberate choice. There is no build to run, no lockfile to rot, and
nothing to keep in sync when you clone it. The cost is that `index.html` is one
large file.

## Licence

MIT. See [LICENSE](LICENSE).
