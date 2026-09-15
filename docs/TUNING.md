# Tuning

Every dial in the game, what it does, and where it lives. Almost all of them are
in `js/data.js`; the exceptions are noted.

Change a number, reload the page. There is nothing to rebuild.

> **Before you retune anything:** the two rules the design leans on are that a
> difficulty changes how well a driver *thinks* and never what its car may do,
> and that bots run the player's mechanics rather than a copy. Both are easy to
> break with a well-meaning multiplier.

---

## Pace and progression

| Constant | Value | Means |
| --- | --- | --- |
| `BASE_SPEED` | `420` | road speed at 1.00×, in design px/s |
| `SPEED_SECONDS` | `30` | how often the road steps up a tier |
| `MULT_STEP` | `0.05` | how much each tier adds |
| `MAX_MULT` | `2.00` | the ceiling |
| `MAX_TIER` | derived | `(MAX_MULT − 1) / MULT_STEP` = 20 tiers, so 10 minutes to top speed |
| `TRACK_SECONDS` | `60` | seconds on a track before it hands over to the next |

Distance is `speed × dt × 0.075`, so 1.00× ≈ 31.5 m/s. That `0.075` is inline in
`race.js` and in `metersOf()`; it is the only place metres and pixels meet.

## Race structure

| Constant | Value | Means |
| --- | --- | --- |
| `RACE_MINUTES` | `5` | bots/local: minutes before the run to the flag begins |
| `FINAL_TRACKS` | `3` | track changes after that, then the flag is planted |
| `FINISH_STRETCH` | `900` | metres of the last track before the line |
| `FIELD_SIZE` | `6` | cars on the road, however they are driven |
| `LOCAL_MAX` | `4` | most people on one screen |
| `PARK_BASE` | `0.60` | car heights past the line for the last car home |
| `PARK_STEP` | `0.44` | car heights between one finishing place and the next |
| `PARK_EASE` | `3.9` | how hard the roll-out closes on its mark |

`PARK_STEP` is set by the lane cycle: consecutive places sit in different lanes,
so the only pair that ever shares a lane is three places apart, and `3 × 0.44`
leaves a third of a car between them. Any larger and sixth place falls off the
bottom of the screen when you win.

## Boost

Not constants — these are inline in `race.js`, in `update()` for you and
`updateRival()` for everyone else. Both sides use the same numbers on purpose.

| Number | Value | Means |
| --- | --- | --- |
| drain | `dt × 0.4` | 2.5 seconds from full to empty |
| refill | `dt × 0.14` | ~7.1 seconds back to full |
| speed | `× 1.5` | while boosting |

Run it completely dry and it locks out until the bar is full again.

## The launch

| Constant | Value | Means |
| --- | --- | --- |
| `AIR_BRAKE` | `1.4` | seconds of hold from cruise to a dead stop |
| `AIR_ARM` | `0.60` | the meter must get under this to launch |
| `AIR_WIND` | `1.6` | seconds of wind-up available once stopped |
| `AIR_STOP_POW` | `0.42` | strength at a dead stop, before any wind-up |
| `AIR_MIN_T` / `AIR_MAX_T` | `0.85` / `3.8` | air time, weakest to strongest |
| `AIR_MIN_K` / `AIR_MAX_K` | `1.18` / `2.80` | road speed while up there |
| `AIR_HOP` | `2.8` | peak height at full strength, in car heights |
| `AIR_CD` | `10` | seconds before the next launch |

The meter is the speed left in the car, one for one, so "empty" means stopped and
the bar can never disagree with the road. The wind-up then refills the same track
in white. `airPower()` is the one place the two phases become a single number —
air time, speed, height and the size of the bang all read it and nothing else.

`AIR_CD` is also the refill: the red bar coming back *is* the cooldown.

## Contact

| Constant | Value | Means |
| --- | --- | --- |
| `BUMP_SLOW` | `1.3` | seconds of labouring after being barged |
| `LAUNCH_TIME` | `0.8` | seconds the shunted car is pushed along for |
| `LAUNCH_BOOST` | `1.35` | how fast it is pushed |

Both cars lose the same time to a bump. A rear-end also has a 0.5s per-car
cooldown (inline in `rearEnd`) so one collision cannot fire every frame.

## Ultimates

| Constant | Value | Means |
| --- | --- | --- |
| `ULT_CHARGE` | `75` | seconds from empty to ready — the same clock for every car |
| `ULT_TIME` | `5` | seconds an ultimate lasts |
| `ULT_SPEED` | `2.0` | pace multiplier while one is running |
| `ULT_ON_WRECK` | `−0.10` | meter cost of being destroyed |
| `ULT_ON_TRAP` | `−0.05` | meter cost of hitting a hazard |
| `ULT_ON_KILL` | `+0.10` | meter reward for wrecking somebody |

While an ultimate runs, the meter is its remaining duration, so those deltas wait
until it is over rather than cutting it short (`ultDelta` enforces this).

### Per car

| Constant | Value | Car | Means |
| --- | --- | --- | --- |
| `ORB_COUNT` | `3` | Bolt | orbs per ultimate |
| `ORB_GAP` | `0.55` | Bolt | seconds between orbs going out on their own |
| `ORB_SPEED` | `1500` | Bolt | px/s, and they never slow down |
| `ORB_R` | `7` | Bolt | hit radius |
| `SHOCK_TIME` | `5` | Bolt | seconds a hit car is pinned. Does not stack — an orb arriving at an already-pinned car seeks the next one up the road |
| `POWER_TIME` | `5` | Bolt | seconds added per orb that comes home. These *do* stack |
| `CHRONO_TIME` | `5` | Timestamp | seconds the world drags |
| `CHRONO_RATE` | `0.5` | Timestamp | and by how much |
| `BLOOM_TIME` | `5` | Rose | seconds a screen stays fouled |
| `CLUTTER_MAX` | `5` | Rose | stages the clutter can be driven to. Only contact deepens it |
| `ORDER_TIME` | `5` | Siren | seconds the orders stand |
| `SIREN_RANGE` | `260` | Siren | how far ahead the sweep reaches, in px |
| `CLEANSE_TIME` | `1` | Siren | the wipe it opens with |

## Hazards

| Constant | Value | Means |
| --- | --- | --- |
| `BLIND_TIME` | `2.6` | puddle: seconds the view stays fouled |
| `SLOW_TIME` | `1.7` | tumbleweed: seconds at half speed |
| `DEAD_TIME` | `3` | seconds wrecked |
| `IMMUNE_TIME` | `2` | seconds untouchable after respawning |
| `METEOR_ALT` | `300` | how far up the rock comes in |
| `METEOR_MIN_T` | `0.9` | never less warning than this |
| `METEOR_MAX_T` | `3.2` | and never hanging longer than this |
| `METEOR_ROCK_K` | `0.66` | the last fraction of the fall, with the rock in view |

The meteor's ring is a **position on the road**, and its remaining fall is measured
in **seconds** — so braking, launching or boosting moves where it lands, not when.
Only chronokinesis stretches the fall. `rockAlt()` is the single answer to "how
high is it", read by the fall, the roof test and the drawing alike.

Spawn spacing is inline in `race.js`: a hazard every `rand(430, 900)` of road, and
none while a track seam is crossing.

## Mystery bubbles and items

| Constant | Value | Means |
| --- | --- | --- |
| `BUBBLE_GAP` | `[5400, 8600]` | road distance between rows |
| `BUBBLE_R` | `21` | draw and catch radius, scaled by scene |
| `BUBBLE_LIFE` | `30` | stall-breaker clock; only runs when the road has all but stopped |
| `BUBBLE_BLINK` | `1.6` | seconds of flashing before a row goes |
| `ITEM_SWAP` | `0.34` | seconds the box flashes on a trade |
| `CAN_TIME` | `2.2` | boost can: seconds of it |
| `CAN_SPEED` | `1.55` | boost can: pace, and it does not touch the boost meter |
| `OIL_LIFE` | `15` | seconds a slick stays live |
| `OIL_FADE` | `0.9` | seconds it spends fading out harmlessly afterwards |
| `SLIP_TIME` | `4` | seconds of reversed steering after touching one |
| `MISSILE_SPEED` | `2100` | seeker px/s |
| `MISSILE_LEN` | `1.45` | nose to tail, in car heights |
| `MISSILE_BODY` | `0.55` | body half width, in car widths |
| `MISSILE_FIN` | `0.92` | fin reach from centre, in car widths |

`SLICK_KINDS` holds four oil shapes — a round pool, a long smear, a scattered
splatter and a thin ribbon — each with a radius range, rotation, edge raggedness
(`jit`), sheen and droplet count. Each drop then gets its own seed on top, so even
two pools differ.

### Drop odds

Odds come from `RARITY` weights, and the garage table is computed from the same
numbers the roll uses, so the printed odds can never drift from what drops.

| Rarity | Weight | Item | Normally | When leading |
| --- | --- | --- | --- | --- |
| common | `60` | Boost can | 66.7% | 70.6% |
| rare | `25` | Oily oil | 27.8% | 29.4% |
| epic | `10` | *(unused)* | — | — |
| legendary | `5` | Seeker | 5.6% | — |

The seeker is never offered to whoever is already leading; out in front its share
is redistributed across the other two. `epic` is defined and coloured but no item
currently uses it.

## Difficulty

`DIFFS` in `data.js`. None of these may ever multiply speed, charge rate or any
car capability — they describe the driver, not the car.

| Field | Means |
| --- | --- |
| `lapse` | how often it simply fails to see trouble in its own lane |
| `react` | `[min, max]` seconds before it acts on what it sees |
| `tick` | `[min, max]` seconds between reconsidering the race at all |
| `look` | how much further ahead than the road in front it reads hazards |
| `read` | how many seconds of the future it projects other cars into |
| `skill` | master competence; weights the quality of every judgement below |
| `hunt` | how deliberately it picks an offensive target rather than lashing out |
| `guard` | how well it protects the place it is holding |
| `judge` | how well it values an item or an ultimate against the situation |
| `air` | how much of the launch it understands — escape only, up to setting one up as an overtake |
| `wind` | the most wind-up it is willing to stand still for |
| `plan` | how many think-ticks an intention survives before it is thrown away |
| `noise` | how much of its decision is left to chance |
| `block` `aggro` `boost` `ult` `keep` | lane and throttle appetites |

`TEMPERS` gives each car a leaning — `nerve`, `spite`, `patience`, `guard`,
`flair` — and `makeTemper()` jitters it by ±0.17 at the start of every race, so
five bots on one setting are not the same bot five times.

## Input

In `js/input.js`:

| Constant | Value | Means |
| --- | --- | --- |
| `SWIPE_STEP` | `42` | px of horizontal travel that counts as a lane change |
| `SWIPE_LOCK` | `0.18` | seconds before a held drag may step again |
| `TAP_SLOP` | `14` | px a tap may wander and still count |
| `LONG_PRESS` | `0.35` | seconds of one-finger hold that fires the ultimate |
| `DOUBLE_TAP` | `0.5` | seconds within which a second tap uses the item |

Vertical gestures use a fixed 34px threshold, inline in the `pointermove` handler.

In `js/local.js`:

| Constant | Value | Means |
| --- | --- | --- |
| `STICK_ON` | `0.55` | pushed |
| `STICK_OFF` | `0.32` | centred — the gap between the two is deliberate hysteresis |
| `LANE_REPEAT` | `0.26` | seconds between steps while a stick is held over |
| `PAD_*` | | standard-mapping button indices |

## HUD

| Constant | Value | Where | Means |
| --- | --- | --- | --- |
| `PIP_FAR` | `500` | `data.js` | past this, an off-screen racer gets chevrons on the ladder instead of an edge badge with a distance |
| `EDGE_W` | `58` | `data.js` | edge badge width — sized for three digits and an `m` |
| `EDGE_ROW` | `32` | `data.js` | drop to the next row of badges |
| `FAR_W` | `34` | `data.js` | far marker width: two chevrons and nothing else |
| `PLACE_COLS` | | `data.js` | gold, silver, bronze, then white |
| `PCOLS` | | `data.js` | the four player colours, in join order |
| `EFF_MAX` | `6` | `hud.js` | most effect labels on screen at once; the oldest makes room |

## Miscellaneous

| Constant | Value | Where | Means |
| --- | --- | --- | --- |
| `SPLASH_MS` | `2600` | `core.js` | how long the splash stays up |
| `SPLASH_IMAGE` | `""` | `core.js` | a data URI or a path to replace the built-in mark; empty keeps the mark |
| `TRAFFIC_ENABLED` | `false` | `core.js` | civilian traffic. Currently off — see the note below |
| `RAINBOW` | | `data.js` | the seven bands of the space track |
| `TRAFFIC_PAINT` | | `data.js` | six paint schemes for civilian cars |

### Traffic

`TRAFFIC_ENABLED` is `false`, which switches off `spawnWave` and `breakWalls` and
leaves `G.traffic` empty. Two visible consequences: endless mode's description
still mentions dense traffic, and `crash()` — the "You clipped traffic" race-over
path — is unreachable, so an endless run only ends when you leave it. Flipping the
flag to `true` brings the whole system back; nothing else needs to change.

### Unused constants

Two leftovers are declared but never read. They are harmless and are left in place
rather than removed:

| Constant | Where | Note |
| --- | --- | --- |
| `RIVAL_LAPSE` | `data.js` | superseded by the per-difficulty `lapse` field |
| `LANDSCAPE` | `core.js` | from before the road always ran up the screen |
