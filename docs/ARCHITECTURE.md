# Architecture

How SEREN is put together, and where to change what.

The whole game is fourteen classic `<script defer>` files, one stylesheet and one
HTML shell. There is no build step, no bundler, no package manager and no
dependency. If you can serve a directory, you can develop it.

---

## Contents

- [The loading contract](#the-loading-contract)
- [One shared scope](#one-shared-scope)
- [The `who` convention](#the-who-convention)
- [Game state: `G`](#game-state-g)
- [The frame](#the-frame)
- [Coordinates and the split screen](#coordinates-and-the-split-screen)
- [File by file](#file-by-file)
- [Invariants worth not breaking](#invariants-worth-not-breaking)
- [How to add things](#how-to-add-things)
- [Testing](#testing)

---

## The loading contract

`index.html` ends with fourteen tags in exactly this order:

```
core → i18n → data → audio → runtime → ui → local → ai → mechanics → race → render → hud → input → main
```

`defer` buys two guarantees: the document is fully parsed before any of them run,
and they run **in document order**. Both matter.

The order is a real dependency order for anything that executes *at load time*:

| File | Needs at load time |
| --- | --- |
| `i18n.js` | `store` from `core.js` |
| `runtime.js` | `$` from `core.js`, `ULT_TIME` from `data.js` (it is in the `G` literal), and `#cv` in the DOM |
| `ui.js`, `audio.js` | `store` from `core.js` |
| `input.js` | `cv` from `runtime.js` (it registers listeners on it) |

Everything else is function bodies, which do not care about order because they do
not run until `main.js` boots. That is why `applyLang()` in `i18n.js` can call
`paintPicks()` from `ui.js`, loaded five files later — the call happens at boot,
by which point every script has executed.

**`main.js` is last and is the only file that starts anything.** Other files
define systems; `main.js` connects and starts them. If you find yourself wanting
to run something at load time in another file, that is the signal it belongs in
`main.js`.

## One shared scope

There is no IIFE and no module system. Every file opens with `"use strict"` and
declares into the one global script scope, so `mechanics.js` can call `later()`
from `race.js` without ceremony.

The consequences, stated plainly:

- `function` declarations become properties of `window` (347 of them).
- `const` / `let` become global lexical bindings — visible everywhere, but not on
  `window` (179 of them).
- **Every top-level name must be unique across all fourteen files.** A duplicate
  `const` is a `SyntaxError` that kills the page; a duplicate `function` silently
  wins.
- None of the 526 current names collides with a browser global. Keep it that way —
  avoid `name`, `status`, `length`, `top`, `self`, `origin`, `event`, `screen`,
  `history`, `location`, `find`, `focus`, `blur`, `open`, `close`, `print`, `stop`.

`node tools/check.mjs` enforces both, so you do not have to remember them.

This was a deliberate trade for staying build-free. Hiding the internals again
means either a bundler or rewriting 526 cross-file references as imports.

## The `who` convention

Almost every gameplay function takes a `who` that is one of two things:

- the string `"me"` — player one, whose state lives directly on `G`
- a **rival object** from `G.rivals` — every other car, bot or human

The idiom that appears everywhere is:

```js
const o = who === "me" ? G : who;
```

This is why the same function drives a bot, a second player on a controller, and
you. `startUlt`, `useItem`, `tickUlt`, `shockCar`, `scrubBad` and the rest each
have exactly one implementation.

Field names differ slightly between the two — `G.shockT` vs `R.shock`, `G.bloomT`
vs `R.clutter`, `G.slowT` vs `R.slow` — a historical wart. Helpers like
`immuneWho`, `noContact`, `ultPower` and `warded` exist to paper over it; prefer
them to reaching into the fields.

Player one is *also* listed in `G.humans[0]` as the string `"me"`, so local-play
code can iterate seats uniformly.

## Game state: `G`

One object in `runtime.js` holds the entire mutable race. It is reset field by
field in `startRace()` — not replaced — so every reference stays valid.

Roughly grouped:

| Group | Fields |
| --- | --- |
| Lifecycle | `state` (`idle` / `countdown` / `running` / `paused` / `over`), `mode`, `diff`, `timers` |
| Your car | `lane`, `x`, `tilt`, `speed`, `meters`, `charge`, `boosting`, `dead`, `immune` |
| Your ultimate | `ult`, `ultOn`, `ultT`, `ultMax`, `powered`, `orbs`, `orbFireT` |
| Your launch | `brakeOn`, `brakeKey`, `brakePtr`, `brakeSpent`, `airMeter`, `airWind`, `airT`, `airMax`, `airPow`, `launchCD` |
| Statuses on you | `slowT`, `shockT`, `blind`, `chronoT`, `orderedT`, `slipT`, `bloomT`, `clutterLv`, `cleanseT`, `canT` |
| The world | `biome`, `next`, `seam`, `build`, `props`, `walks`, `traps`, `fx`, `traffic` |
| Objects in play | `boxes` (bubble rows), `slicks`, `missiles`, `bolts` (orbs) |
| The field | `rivals`, `humans`, `picks`, `results`, `finished`, `finishAt`, `tracksLeft` |
| Local play | `local`, `players`, `padIds`, `seat`, `pk`, `custom`, `rules` |

`G.rules` is the custom-race rule set (`{bots, traps, bubbles, boost, ults}`).
Never read it directly — use `ruleOn("traps")` and `botsWanted()`, which cope with
it being missing.

## The frame

```
frame(ts)                       race.js — requestAnimationFrame loop
  dt = min(ts - last, 0.05)     one clamp, so a background tab cannot leap
  update(dt)                    race.js — advance the world
  render()                      render.js — draw it
  paintHUD(false)               hud.js — sync the DOM HUD
```

`update(dt)` is the single ordering authority. Its shape:

1. `tickCountdown` and `viewBounds`
2. local play: poll pads, check for a dropped controller, drive each seat
3. your speed, distance, boost charge, lateral position
4. scroll the world; generate scenery ahead, cull behind
5. the race clock and track/speed-tier timers
6. your ultimate: charge, tick, fire
7. your status timers, then `updateLaunch`
8. `updateBubbles` → `updateSlicks` → `updateMissiles` → `updateTraps`
9. your rear-end check, then `updateRivals` (each rival's whole frame)
10. `serveOrders`, `updateBolts`, `checkFinish`, `updateFx`, seam handover

Two things follow from that order and are easy to break:

- **Rivals move after the world does.** A rival's frame reads a world that has
  already scrolled this tick.
- **`updateRivalLaunch` runs before `rivalThink`**, so a bot decides on the road
  it is actually on.

Pausing works by returning early from `update` (`state === "paused"`), which is
why the countdown is driven from the frame loop and not from a timer — a timer
would keep running behind the pause panel. Race-lifecycle timeouts that *must*
survive go through `later()`, which records them in `G.timers` so `clearTimers()`
can cancel the lot between races.

## Coordinates and the split screen

Everything is drawn in **design pixels**; the canvas backing store is sized by
`DPR` and the desktop scale, and `ctx.setTransform` divides that back out. Game
code never thinks about device pixels.

Local play draws the same world once per person, in equal columns:

| Name | Means |
| --- | --- |
| `W` | the width of **one view**, never of the canvas |
| `FULLW` | the whole canvas, in design px |
| `VIEWS` | how many columns the canvas is cut into |
| `CAMDY` | this view's camera shift, in master screen px |
| `CT`, `CB` | what this view can see, in master screen coords |
| `VOWN` | whose view is being drawn (`"me"` or a rival) |
| `VW_TOP`, `VW_BOT` | the union of every view — what the world must cover |

Because `W` is one column and every world dimension has always measured off `W`, a
column is simply a narrower game: not one line of road, scenery or car code has to
know how many columns there are.

`VW_TOP`/`VW_BOT` are the reason scenery generation and culling use those bounds
rather than `0`/`H`: with four players strung out along the road, the world has to
exist for all of them at once, or the leader drives through nothing.

`camDy(who)` gives a car's camera offset; `perTop(off, per)` gives the first `y` of
a periodic road pattern at or above the top of the current view.

## File by file

### `core.js` — 48 lines
`store` (localStorage with a memory fallback), `$`, `clamp`, `lerp`, `rand`,
`randi`, `withA` (hex → rgba), and three capability flags: `DESKTOP`, `NO_MOTION`,
`LANDSCAPE`. Plus `SPLASH_IMAGE`, `SPLASH_MS` and `TRAFFIC_ENABLED`.

Nothing here owns a game system. If a helper knows what a car is, it does not
belong here.

### `i18n.js` — 275 lines
`STR` is a flat map of key → `{en, fr}`. `t(k)` returns the current language, and
falls back to English and then to the key itself — a missing string shows as a
visibly wrong key rather than taking down the screen that asked for it.

`applyLang()` sweeps `[data-i18n]` elements and repaints the language-dependent
screens. Adding a language means adding a third code to every entry, adding a
`.lang-opt` button, and nothing else.

### `data.js` — 366 lines
Every definition and every tuning number: `CARS`, `DIFFS`, `TEMPERS`, `EFFECTS`,
`ULT_EFFECTS`, `RARITY`, `ITEMS`, `TRACKS`, and the constants. See
[TUNING.md](TUNING.md).

Loaded before `runtime.js` because the `G` literal reads `ULT_TIME`. Nothing here
has behaviour of its own — `makeTemper`, `bubbleR`, `rockLead` and `rockAlt` are
accessors on the numbers beside them.

### `audio.js` — 62 lines
Everything is generated; there are no audio files. `audio()` creates the context
on first call and caches it, which keeps creation inside a user gesture so
browsers do not refuse it. `tone()` and `noise()` no-op when sound is off or the
context could not be made, so callers never have to check.

### `runtime.js` — 176 lines
The canvas, the two contexts (`roadCtx` and the swappable `ctx`), the road
geometry, the split-view geometry, `G`, the rule readers (`defaultRules`,
`botsWanted`, `ruleOn`, `diff`), `layout()`, `laneCX()`, `deskFit()` and
`resize()`.

`ctx` is a `let` on purpose: `paintCarIcon` in `ui.js` borrows it for a moment so
the select-screen thumbnails come out of the same `drawCar` the road uses, then
puts it back in a `finally`.

### `ui.js` — 250 lines
Screen switching (`show(id)` toggles `.on` classes — there is no router), the
garage, the custom setup sheet, the car board, the personal best, and the
select-screen car art. Gameplay logic does not live here.

### `local.js` — 161 lines
Seats and player colours (`seatOf`, `seatCol`), the pad primitives (`padPoll`,
`padOf`, `padBtn`, `padAxis`, `newPadKeys`) and the two menu loops that run only
while the controller sheet or the car sheet is up.

A seat holds its pad's **slot number**, not its position in the list — the list
closes up when a pad drops out, and binding to "the third one connected" would
hand player three somebody else's controller mid-corner.

### `ai.js` — 621 lines
Sense → weigh → act, once per think-tick.

- `botSense` builds one honest picture of the race from where a car sits.
- `botTarget`, `laneScore`, `botUltValue`, `botItemWorth`, `botAirWant` score the
  options against it.
- `rivalThink` takes the best one and writes down what it meant to do next.

Two rules hold it together. Nothing in here asks whether a car has a person behind
it — the player is a row in the same list, scored by the same terms. And the mind
only ever *decides*: the doing is handed back to the same mechanics your inputs
call.

### `mechanics.js` — 1,868 lines
The rules of the road, shared by every car on it: contact and collisions, lane
changes, boost, the brake and the launch, wrecking and respawning, effects,
ultimates, items, hazards, particles.

`ultContact` is the single authority on what happens when two cars meet, so
barging into a lane and running into a back bumper cannot disagree.

Player and rival versions of a mechanic (`launchCar` / `launchRival`,
`landCar` / `landRival`) exist only because the two carry their state in
different places — they run the same constants and the same rules.

### `race.js` — 939 lines
The race: world seeding and track handover, the grid (`spawnRivals`), the
lifecycle (`startRace`, countdown, `pause`, `leave`, `crash`), the finish
(`checkFinish`, `finishRace`, the parking staircase), `update()`, `updateRival()`
and the frame loop.

### `render.js` — 1,703 lines
All Canvas 2D drawing. Six car models, three tracks' worth of scenery and road,
hazards, particles, and the effects that sit over them.

**Draw order here is behaviour** — it decides what covers what. `renderView(dy)`
is the order for one view; `render()` is the loop over views, with the clip and
translate per column.

This file reads game state and never changes it.

### `hud.js` — 924 lines
Two HUDs that must agree. The DOM one is painted over the canvas (`paintHUD`,
`paintItemBox`, the effect labels); the canvas one is drawn per column in local
play (`drawSeatHud` and friends), because four copies of the DOM HUD would be four
stylesheets to keep in step. Every number, colour and position in the canvas HUD
is read off the page's own HUD so the two cannot drift.

The effect labels are one element per effect for the life of the page, held in a
map and revived rather than recreated, hard-capped at six. There is no path that
can produce an unbounded number of nodes.

### `input.js` — 251 lines
Keyboard, pointer and controller, each translated into the same mechanics call.
`humanSteer`, `humanBoost`, `humanUlt` and `humanBrake` are the four doors; every
input path ends at one of them.

`brakeKey`, `brakePtr` and `padBrake` are the input being physically down;
`brakeOn` is the brake actually biting; `brakeSpent` is the latch that stops key
autorepeat from re-arming a fresh meter without the player lifting a finger.
Keeping them apart is what makes a cancelled hold behave.

### `main.js` — 170 lines
Boot, in order: splash image, desktop class, `deskFit`, `applyLang`, `paintBest`,
`setSound`, the splash timeout, every menu listener, the window resize and
visibility listeners, and `settle()` — repeated once after layout and once after
fonts, in case the first read landed before the stylesheet applied.

## Invariants worth not breaking

1. **One authority per question.** `ultContact` decides contact. `rockAlt` decides
   where a meteor is. `airPower` decides launch strength. If two places compute
   the same thing they will disagree eventually.
2. **Difficulty changes the driver, never the car.** No `DIFFS` value may multiply
   speed, charge rate or any car capability. It buys perception and judgement.
3. **Bots run your mechanics.** If you add a player ability, a bot must reach it
   through the same function, not a copy.
4. **The canvas HUD mirrors the DOM HUD.** A change to one needs the same change
   in the other, or a phone and a split-screen column stop showing the same race.
5. **A winner is out of play.** Finished cars are off every target list and
   nothing can reach them.
6. **`W` is one view, not the canvas.** Anything measuring off `FULLW` in world
   code is a split-screen bug waiting to happen.
7. **Nothing boots outside `main.js`.**

These seven are judgement calls — `tools/check.mjs` cannot check any of them. What
it does check is the layer underneath: that the files load in the right order,
that names do not collide, and that every selector, string and table entry the
code reaches for actually exists.

## How to add things

### A car

1. `CARS` in `data.js` — an entry with `key`, `style`, `accent`, `body`, `dark`,
   `glass`, optional `trim`/`pip`, `flame` and a `power` id.
2. `CAR_IDS` — append the id.
3. `TEMPERS` in `data.js` — a leaning for it.
4. `ULT_EFFECTS` in `data.js` — which labels its driver wears.
5. `render.js` — a `drawX(w, h, p, isPlayer, boosting)` function, plus a branch in
   `drawCar`'s `style` dispatch.
6. `mechanics.js` — handle the new `power` in `startUlt`, `endUlt` and `tickUlt`,
   and in `bumping()` / `burning()` / `ghosting()` if it belongs to one of those
   classes.
7. `i18n.js` — `<id>` (its name) and `<id>Ult` (its description), in both
   languages.
8. `index.html` — a `.car-opt` button with `id="car<Id>"` containing
   `<canvas class="car-cv" data-car="<id>">`.
9. `main.js` — a click listener for the new button.
10. `ai.js` — a branch in `botUltValue` so bots know what the ultimate is worth.

Note `FIELD_SIZE` is 6 and local play hands every car in the game to the grid, so
a seventh car changes the shape of a local race.

### A track

`TRACKS` and `TRACK_IDS` in `data.js`, a `<id>Info` string in `i18n.js`, scenery
and road branches in `render.js` (`drawSide`, `drawProps`, `drawRoad`,
`drawEdges`, `drawMarks`, `drawFeatures`), and a hazard branch in `spawnTrap` in
`mechanics.js`.

### An item

`ITEMS` and `ITEM_IDS` in `data.js` with a rarity, artwork in `ITEM_PATHS` in
`hud.js`, a branch in `useItem` in `mechanics.js`, `itemX` / `itemXInfo` strings,
and a branch in `botItemWorth` in `ai.js`. The garage odds table and the drop roll
both read `RARITY`, so they cannot disagree.

### A status effect

`EFFECTS` in `data.js`, an `<id>Info` string, and a line in `syncEffects` in
`hud.js` — which is the only place the labels are derived, so an effect that has
quietly lapsed cannot leave its label behind. Mark it `bad: true` if Cleansed
should wipe it.

## Checking your work

Most of the invariants above are mechanically checkable, and
[`tools/check.mjs`](../tools/check.mjs) checks them:

```sh
node tools/check.mjs
```

Plain Node, no dependencies, no `package.json`, exits non-zero on failure. It
covers the script order and `defer`, syntax, the uniqueness of every top-level
name, browser-global collisions, every literal `#id` selector against the real
DOM, translation completeness and key resolution, and the wiring of every car,
effect and item.

That is the cheap half. It cannot tell you whether the game still *plays* the
same — for that, see below.

## Testing

There is no test suite and no test dependency, by design — the brief is a
build-free static site.

What has been used, and is worth repeating after a substantial change:

- `node tools/check.mjs` first — it is instant and catches the silent failures.
- Serve the directory and drive it in a headless browser
  ([Playwright](https://playwright.dev/) against the system Chromium works well
  without adding anything to the repo). The flows worth covering are the ones in
  the modes list: boot, language and sound persistence, the garage tabs, each
  mode's path to the grid, the countdown, lanes, boost, brake/launch/cooldown,
  pause/resume, leave, the personal best, and a four-player split.
- For anything touching gameplay numbers, diff against the previous build rather
  than eyeballing it: seed `Math.random`, run both, and compare the HUD values
  frame for frame. Frame timing still varies between runs, so treat a single
  mismatched sample as noise and repeat before believing it.
- Fake gamepads through `navigator.getGamepads` to exercise local play; the code
  reads only `index`, `id`, `connected`, `buttons[i].pressed/.value` and
  `axes[i]`.
