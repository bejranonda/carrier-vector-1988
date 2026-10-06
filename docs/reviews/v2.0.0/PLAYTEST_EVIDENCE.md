# v2.0.0 — Playtest Evidence

Everything here was measured in headless Chromium (Playwright, the
pre-installed browser) against the Vite dev build, through the dev-only
`window.__game` handle. **No humans.** Three instruments:

1. `npm run playtest` — the checked-in harness, rewritten for the v2.0.0 flow
   (48 checks).
2. A **button-masher** — presses SPACE every 150 ms from the moment it lands,
   never steers. Stands in for a player who does not read anything.
3. A **steering bot** — reads the designated target's bearing and elevation,
   holds A/D/W/S toward it (bank capped at ~50°, no throttle use), fires an
   AIM-9 every 1.2 s when the target is within 12° and 3.5 km, holds the gun
   inside 1.2 km. Stands in for a weak but attentive beginner.

---

## 1. v1.11.0 as found

### Time to first kill, new player

The training sortie (the first-flight mission) asks for a catapult launch, a
climb to 2,500 ft, the autopilot, then the drone. A scripted pilot that obeys
the objective strip the instant it changes (ENTER, hold W, F, 2 + SPACE):

| Time after ENTER | Objective |
| :-: | :-- |
| 0.6 s | CATAPULT LAUNCH |
| 3.2 s | CLIMB TO 2,500 FT |
| 12.2 s | ENGAGE AUTOPILOT |
| 12.6 s | SPLASH THE DRONE |
| **13.9 s** | first kill |

That is a floor: no reading time, no hesitation, no wrong key. This review's
first draft had *estimated* "over two minutes" from the shape of the flow; the
measurement corrected it. The real cost was never the seconds alone - it was
four instructions to read and obey before the first reward, with a trap
landing still owed to finish the mission. A returning player skipping the deck
(`S`) into Carrier Defense got kills inside ~10 s.

### Carrier Defense, returning player, masher + autopilot

| Time | Observation |
| :-: | :-- |
| 4.5 s | `MISSILE INBOUND - CHAFF [X]...` coach line appears... |
| 75 s | ...is replaced by `TRAINING 1/6 - PITCH: HOLD [W]` — the beginner checkout, for a pilot who had cleared the training sortie (**#88**) |
| 9-11 s | Four kills in two seconds -> `SPLASH FOUR / THREE / TWO` + `FIRST BLOOD!` stacked (**#92**) |

### Deck screen, desktop

`MENU (ESC)` drawn over `FLIGHT DECK` (**#91**) — visible in the v1.11.0
harness's own `desktop-02-deck.png`.

---

## 2. Building SCRAMBLE — what the scripted players broke

### Masher, first SCRAMBLE build

| Measure | Result |
| :-- | :-- |
| Missiles left when wave 1 spawned | **0** — all four fired at empty sky in the first 0.6 s (**#93**) |
| Kills in 64 s | 0; both wave-2 bombers reached the boat |

Fix: no target, no launch (`NO TARGET`); empty rail -> `GUNS`; rearm
reselects missiles.

### Steering bot, after that fix

| Measure | Run 1 | Run 2 |
| :-- | :-: | :-: |
| **First kill after ENTER** | **4.2 s** | **4.3 s** |
| Waves reached in 240 s | 3 | 4 |
| Stall: one live bandit, no lock, for > 2 min | **yes** | yes |

The stall: a surviving MiG out of line of sight (fjord walls) or flying off
toward the carrier left `SPLASH 1 BANDIT` on screen with nothing to point at.
Fix: AEW picture in SCRAMBLE (every bandit designatable), fighters that hunt
the player, automatic re-lock, a 75 s bug-out. After: waves 5 reached in both
240 s runs, no stalls.

### Missile accounting

The bot fired 12 AIM-9s for 3 kills. Instrumenting the weapons update to
classify every missile's end:

| Build | Hit | Into terrain | Motor out | Target already dead |
| :-- | :-: | :-: | :-: | :-: |
| Before #90/#94 | 3 | 4 | 5 | — |
| Logged miss distances | | | `[1681 m -> 3 m]`, `[1161 m -> 7 m]` on `W1-TU-22-0` | |

"Motor out" rounds had closed to **3-7 m** of a bomber another round had
already killed (**#94**). Separately the HUD had been calling IN RANGE at 8 km
(**#90**).

**A hypothesis that the measurement killed:** the review first blamed the
AIM-9's pure-pursuit guidance and swapped in lead pursuit. A headless sweep —
5 bearings × 4 ranges × 4 target headings, cruising and hunting fighters —
scored **80/80 for both laws**. The guidance change was reverted. The causes
were #90, #93 and #94.

---

## 3. v2.0.0 as shipped

### Harness (`npm run playtest`) — 48/48

Key new checks, with measured values from the final run:

| Check | Value |
| :-- | :-- |
| New pilot routed to SCRAMBLE | `SCRAMBLE` |
| ENTER on the briefing -> airborne | `AIRBORNE`, `MICRO_FLIGHT`, 0.4 s |
| Missiles armed for the first shot | `AIM9` |
| **First kill within 10 s of ENTER** | **4.59 s** |
| No approach hint in SCRAMBLE | `null` |
| The debrief pays a star and career XP | 1 star, 3,444 XP |
| ENTER on the debrief flies again, airborne | `SCRAMBLE`, `AIRBORNE` |
| Key 2 -> training sortie -> deck -> launch | all pass |
| No "line up with the deck" on the climb-out | `null` |
| A veteran sees no beginner checkout | 0 items |
| Phones: FLY puts a new pilot in the air; chaff; training deck; LAUNCH | all pass, 2 handsets |
| `/?c=424242.5000.3` opens SCRAMBLE with the run to beat, on seed 424242 | pass |

### Steering bot, final build, 200 s

| Measure | Run 1 | Run 2 |
| :-- | :-: | :-: |
| First kill | 4.3 s | 4.2 s |
| Waves cleared | 4 | 4 |
| Jets lost | 1 | 1 |
| Stalls | 0 | 0 |

Read this as a floor. The bot never touches the throttle (it ends most runs at
~100 m/s with `LOW AIRSPEED` on the coach) and banks no harder than ~50°, so
hunters sit on its tail. That is what #97 is about.

### Screens

The harness writes every screen to `playtest-output/` (git-ignored). The ones
this review leaned on: `desktop-03-first-kill.png` (ring, `+250`, banners),
`desktop-08-debrief.png` (star, count-up score, XP bar, PROMOTED, FLY AGAIN),
`phone-landscape-02-airborne.png`, `training-01-deck.png` (title clear of the
menu button), `laptop-03-veteran-deck.png`.

### Build

284.7 kB raw / 93.4 kB gzip (v1.11.0: 253.6 / 82.0). +11.4 kB gzip for a new
mode, a progression layer, a debrief, effects, a soundtrack and challenge
links. Zero runtime dependencies.
