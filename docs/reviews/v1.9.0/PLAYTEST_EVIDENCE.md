# v1.9.0 — Playtest Evidence

**Raw facts only.** No opinions, no scores, no recommendations — those live in
the other three documents in this folder. Everything here is a measurement, a
screenshot observation with coordinates, or a `file:line` citation.

This document exists because five previous review suites reached the right
diagnosis and the defects survived anyway. Opinions did not make it through;
numbers might.

* **Build under test:** `v1.8.0`, commit `d7fb93d`
* **Date:** 2026-09-21
* **Test suite at start:** 921 passed / 0 failed / 51 files
* **Typecheck:** clean
* **Production bundle:** 234 kB raw, 75.4 kB gzip
* **Harness:** headless Chromium 1194 via Playwright, `vite preview` (production
  build) and `vite dev` (for the `window.__game` telemetry handle, which is
  stripped from production by `main.ts:26`)
* **Viewports:** 1440×900, 1280×720, 844×390 (phone landscape), 390×844 (phone
  portrait)

---

## 0. Player Evidence (verbatim)

The human who commissioned this review, on the live GitHub Pages build:

```
1. "As beginner, I feel there are a lot of info on the screen,
    I do not know what to do and to start!"
2. "It is hard to understand how to control the game and the jet."
```

| # | Player said | Misunderstanding, or real defect? | Evidence |
| :-: | :-- | :-- | :-- |
| 1 | Too much on screen, don't know where to start | **Real defect, and worse than reported.** Four pairs of HUD elements were drawn into the *same rectangle*. The screen was not merely dense; it was printed on top of itself. | §2 |
| 2 | Hard to understand how to control the jet | **Real defect.** The default HUD mode deletes the attitude reference, so a nose-high attitude — the actual reason a turn will not come round — is invisible. Compounded by a coaching hint that is wrong on every launch. | §3, §4 |

Both complaints reproduce 100% of the time on a stock first run. Neither is a
misunderstanding.

---

## 1. First-run routing — works as documented

`GameLoop.start()` (`src/core/GameLoop.ts:1035-1040`) selects `TRAINING_SORTIE`
when every mission record shows zero attempts. Verified:

```
BRIEF  {"phase":"BRIEFING","scen":"TRAINING_SORTIE", ...}
```

The v1.8.0 changelog claim is **true**. The briefing also marks the pill
`START HERE` (`BriefingScreen.ts:303` via `recommendScenario`). This is the one
onboarding mechanism in the game that is fully wired end to end.

---

## 2. HUD elements drawn into the same rectangle — four confirmed

All four are unconditional at the default desktop size. All four are arithmetic,
not edge cases.

### 2.1 Objective strip ∩ compass tape

| Element | Source | y-range |
| :-- | :-- | :-- |
| Objective strip | `HUD.ts` `drawObjectiveStrip`, `y = BAND.objective`, `h = 54` | **54 – 108** |
| Compass tape plate | `HUD.ts` `drawCompassTape`, `y = BAND.compass - 20`, `h = 32` | **76 – 108** |

The heading tape was drawn *entirely inside* the objective strip. Screenshot
`02` at 1440×900 shows the mission detail line rendered as
`Cl32b to33 58034ft (350 m)N Cur01ent a02titud03 1704m.` — the compass numerals
28…35/N interleaved character-by-character with the order the mission is giving
you. Both strings were unreadable.

Root cause: `BAND` was five hand-picked constants
(`{top:20, objective:54, compass:96, warning:132, coach:168}`), and `compass`
needed to be ≥ 128 for the strip above it to clear.

### 2.2 Arcade pill bar ∩ assist annunciator ∩ keycap strip

At `height = 900`:

| Element | Source | y-range |
| :-- | :-- | :-- |
| Arcade pill bar | `HudLayout.ts` `arcadeBar.y = 52`, `pillH = 34` | **848 – 882** |
| Assist annunciator | `HUD.ts` `drawAssistAnnunciator`, `y = height - 52`, `h = 22` | **848 – 870** |
| Keycap cheat strip | `HUD.ts` `drawKeyBar`, `y = height - 22`, 10 px centred | **≈873 – 883** |

Three independent elements, three different methods, one 35 px band.
Screenshot `07` shows `TERRAIN — AUTO PULL-UP` printed through the `REWIND 5S`
pill, with `F ASSIST U hud density I invert pitch` running through both.

`HUD.instrumentBoxes()` already *reserved* the annunciator band
(`{y: height - 56, h: 30}`) — but only for floating-label decluttering. The pill
bar and the cheat strip never consulted it.

### 2.3 Score chip ∩ top-right button row

| Element | Source | Rect |
| :-- | :-- | :-- |
| Score chip | `drawScoreChip`, `x = width - w - 20`, `y = 18`, `h = 26` | flush right, **18 – 44** |
| DECK / HUD / STICK buttons | `drawTopRightControls`, `y = 16`, `h = 28` | flush right, **16 – 44** |

The chip is drawn first, so on every desktop frame the player's score and rank
were printed underneath the `DECK (TAB)` button. Visible as ghost glyphs behind
that button in screenshots `07`, `09`, `m-laptop-small-air`.

### 2.4 Help overlay — FLIGHT labels ∩ SYSTEM keycaps

`BriefingScreen.ts` drew `ctx.fillText(b.label, x + 124, y)` with **no width
bound**, while every other string in the file goes through `fitText`. At 1440 px
the label *"Rudder left (fine aim only - you do not need it to turn)"* ran to
x ≈ 795 and the SYSTEM column's keycaps start at x = 738. Screenshot `10` shows
`…you do not need it to[O]urn)`.

---

## 3. The coaching hint is wrong on every launch

`Tutorial.ts` rule, as shipped in v1.8.0:

```ts
match: (s) => s.distanceToCarrier < 2500 && s.airSpeed > 95
```

A catapult shot leaves the boat **fast**, from **zero range**. Both clauses are
therefore true by construction for the first several seconds of *every* launch
in *every* scenario. Measured, 4 s after the training-sortie cat shot:

```
AIR+4 {"obj":"CLIMB TO 2,500 FT",
       "hint":"TOO FAST FOR THE TRAP - REDUCE TO BELOW 90 M/S [CTRL]",
       "altM":201,"spdMS":180,"thr":1.5}
```

The objective strip says **climb**. The hint 60 px below it says **decelerate to
below 90 m/s**. The jet is at 201 m. Obeying the hint at that altitude and
attitude stalls the aircraft.

This is the single most-frequently-seen hint in the game, it contradicts the
order directly above it, and it is dangerous advice. It was still showing at
0.8 NM and 1710 ft in screenshot `09`.

---

## 4. The default HUD has no attitude reference

`HUD.drawPitchLadder` opened with:

```ts
// In Arcade mode, keep the center of the screen clean and uncluttered!
if (this.hudDensity === 'ARCADE') return;
```

ARCADE is the default (`HUD.hudDensity = 'ARCADE'`). Suppressing the ladder also
suppressed its zero rung — the artificial horizon. What remained at screen centre
was the three-stroke waterline glyph and nothing else.

Screenshot `09`: after a 4 s left bank the real horizon is off-screen entirely.
The frame contains scattered wireframe in the upper-left quadrant and no
attitude cue of any kind. Telemetry for that same frame: `pitch = 36°`,
`roll = -75°`.

So the player's own description — *"I bank, I pull, nothing happens"* — had a
complete and simple explanation (the nose is 36° above the horizon; the turn is
going into the vertical plane, not the horizontal one) which **the game never
displayed**.

---

## 5. The training sortie damaged the carrier

`TRAINING_SORTIE` (`Scenarios.ts:585-684`) declares:

* tagline: *"Guided familiarization sortie with Ghost-Lead. **Zero combat hostiles**."*
* `lossCondition`: *"Running out of fuel or ditching in the fjord."*
* `setup.combatShielded: true`

Measured, first run, player idle on the deck reading the screen:

```
DECK+10s  hull:100
DECK+20s  hull:85     <-- "[T+20s] WARNING: MiG-23 STRAFING RUN ON FLIGHT DECK! -15% HULL."
DECK+30s  hull:85
```

`combatShielded` was consulted in four places in `GameLoop.ts` (2025-2112), all
of which protect the **player's aircraft**. `DeckManager.update()` ran the
package-reaches-the-carrier damage path (`DeckManager.ts:400-411`) without ever
checking it. The drone that the tutorial calls a training target strafed CV-68
for 15% of its hull while a first-time pilot was reading the deck panels.

The deck's own `EARLY WARNING RADAR` panel labels that contact
`1 INBOUND / FIGHTER 0:18` in red — on the mission that promised zero hostiles.

---

## 6. Flight model measurements

Instrumented in-browser, held input, sampled once per second.
Common start: 2500 m, 200 m/s, wings level, full throttle.

### 6.1 Sustained turn rate

| Input | Assist | Turn rate | 180° reversal |
| :-- | :-- | --: | --: |
| Bank only | ASSIST | **7.2 °/s** | ~25 s |
| Bank + pull | ASSIST | **9.5 °/s** | ~19 s |
| Bank only | MANUAL | **8.3 °/s** | ~22 s |
| Bank + pull | MANUAL | **10.3 °/s** | ~17 s |
| Bank + pull | AUTO | **9.6 °/s** | ~19 s |

Bank-and-pull **is** faster than bank alone — the control reference's *"hold W
to tighten"* is correct. Known Issues #56 already records ~9 °/s as accepted.

### 6.2 But from a nose-high, energy-bleeding state, heading stops moving

Sampled from the state the game actually puts a new pilot in — straight off the
catapult, throttle still at 150% AB, climbing:

```
--- hold A + W, from pitch 35°, 154 m/s ---
  t=1s hdg=257 roll=-75 pitch=35 d/s=-1.0 spd=154
  t=2s hdg=257 roll=-75 pitch=35 d/s= 0.0 spd=150
  t=3s hdg=258 roll=-75 pitch=35 d/s=-1.0 spd=146
  t=4s hdg=257 roll=-75 pitch=35 d/s= 1.0 spd=137
  t=5s hdg=254 roll=-75 pitch=36 d/s= 3.0 spd=130
  t=6s hdg=253 roll=-75 pitch=36 d/s= 1.0 spd=128
  t=7s hdg=254 roll=-75 pitch=36 d/s=-1.0 spd=127
  t=8s hdg=255 roll=-75 pitch=36 d/s=-1.0 spd=126
FINAL hint: "STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]"
```

**Eight seconds of held bank and held back-stick produced 2° of heading change.**
This is aerodynamically correct — the jet is turning in the vertical plane —
but §4 shows the game displayed nothing that would let a player work that out.

### 6.3 Contributing factors to that state

* **Throttle parks at 150% afterburner.** `thr: 1.5` from the catapult stroke
  through the entire 30 s test, with the player never pressing `SHIFT`. The
  v1.8.0 anti-stall floor (`FlightAssist.ts:393`) raises throttle but nothing
  ever retards it. Fuel 5000 → 4862 L in ~25 s of flying nowhere.
* **Roll snaps to the 75° cap instantly** and stays pinned (`roll:-75` at
  t=1 s and every sample after). There is no proportional bank feel; the key is
  effectively a toggle between 0° and 75°.

### 6.4 The unit test that covers this asserts the opposite, and passes

`BankToTurn.test.ts:61` — *"bank and pull swings the nose round faster than the
bank alone"* — exercises **0.6 stick deflection, 6 s, from 220 m/s**. Under
those conditions the property holds. The game gives **1.0 deflection**, from
**180 m/s decaying to 126**, over **8+ s**, from a nose-high start. The test
does not cover the state the game reliably creates.

Not a false test. An incomplete one — and 921 green tests made it invisible.

---

## 7. Screen inventory at 1440×900, default settings

Simultaneously drawn regions in the cockpit, ARCADE density, keyboard mode:

> pitch ladder (suppressed) · flight-path marker · waterline · combat reticles ·
> strike targets · designation box · objective strip · compass tape · airspeed
> block · altitude block · 4 weapon pills · chaff pill · assist pill · rewind
> pill · padlock pill · status telemetry pill · RWR/radar scope · warning banner ·
> coach ticker · callouts · score chip · assist annunciator · 10-pair keycap
> strip · 3 top-right buttons

**≈ 27 draw regions; 33 distinct labelled values; 29 key bindings in the help
overlay.** The v1.4.0 review counted "22 dials" and asked for fewer. Every
release since has added pills.

---

## 8. Deck screen, first screen after pressing ENTER

Desktop 1440×900 (`DeckView.ts`, `DeckLayout.ts:85-96`): **8 panels** —
ORDERS, TURNAROUND, PAYLOAD, THREATS, STATUS, CREW, DECK_PLAN, LOG — carrying
≈ 35 numbers and 4 progress-bar groups, on a tutorial mission.

Two internal contradictions visible in one frame (screenshot `03`):

* `NEXT SORTIE PAYLOAD` offers `MK.82 IRON BOMB 2 / 4` while `STRIKE GROUP
  STATUS` lists `MK.82 IRON BOMB: 0` in stock — and the scenario's own
  `inventory` declares `ironBombs: 0`.
* `EARLY WARNING RADAR: 1 INBOUND / FIGHTER 0:18` in red, on the mission whose
  briefing says *"Zero combat hostiles."*

Phone landscape 844×390 (screenshot `m-phone-landscape-deck`) renders the same
game state as **4 panels and one large `LAUNCH` button**. Same code, same
scenario, radically clearer. The simplified deck screen this game needs on
desktop already exists and already ships — on phones only.

---

## 9. Documentation accuracy

| Claim | Location | Status |
| :-- | :-- | :-- |
| First-time players default to `TRAINING_SORTIE` | CHANGELOG 1.8.0 | **True** (`GameLoop.ts:1035`) |
| "Pitch is clamped to ±88° in `applyPitchInput()`" | `KNOWN_ISSUES.md` §2 | **Stale** — the clamp was removed in v1.7.0 and replaced by `foldPastVertical()` |
| Two different sections both numbered `## 1.` | `KNOWN_ISSUES.md` | Numbering defect |
| "21-Dimension Framework" | `REVIEW_TEMPLATE.md` title | Contradicts `reviews/README.md`, which calls it 25 |

Docs total **8,539 lines** against **19,680 lines** of non-test source.
`docs/reviews/` alone is **3,438 lines across 20 files**. `README.md` is 677
lines.

---

## 10. What was measured and found healthy

* 921/921 tests green, 51 files, `tsc --noEmit` clean, before any change.
* Zero runtime dependencies. 75.4 kB gzip.
* No console errors or page errors across every viewport tested.
* Boot → briefing = 1.8 s (`BriefingScreen.WARMUP_DURATION`), deterministic.
* Briefing screen: mission pills, difficulty pips, `START HERE` marker,
  `NOT YET FLOWN` record line, three phase cards with keycaps, one pulsing
  primary CTA. No overlaps at any tested size.
* Touch layout: correct rotation prompt in portrait; clean 4-panel deck and a
  single large LAUNCH target in landscape.
* Layout solvers `DeckLayout`, `HudLayout`, `TouchLayout` are pure, exported and
  unit-tested. The architecture needed to prevent every defect in §2 was already
  in the repo; the offending draws simply bypassed it.

---

## 11. Post-fix verification (v1.9.0)

Same harness, same viewports, after the Tier-0 changes in
[`RECOMMENDATIONS_AND_ROADMAP.md`](RECOMMENDATIONS_AND_ROADMAP.md) §1:

```
TRAINING hull at T+0: 100   at T+26s: 100      (was 85)
AIRBORNE {"obj":"CLIMB TO 2,500 FT",
          "hint":"IN RANGE - FIRE [SPACE]"}    (was "TOO FAST FOR THE TRAP…")
```

* Objective strip and compass tape render as two separate, fully legible rows.
* Pill bar, annunciator and keycap strip render as three separate rows.
* Score chip sits clear below the button row.
* Help overlay columns no longer intersect.
* Horizon bar with a signed pitch readout is present in ARCADE.
* Test suite: **932 passed / 0 failed** (11 new regression tests).
* Bundle: 235.2 kB raw, 75.8 kB gzip (+0.4 kB).
