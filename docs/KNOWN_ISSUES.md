# Known Issues & Deliberate Trade-offs

## Status at v1.11.0

**Open, deliberately:**

| # | Issue | Why it is open |
| :-: | :-- | :-- |
| 53 | The fjord is a 1-D corridor | New map = new content with scenario re-balancing, not a fix |
| 41 | No key-remapping screen (P2) | Layout independence shipped; build the screen only if feedback asks |
| 82 | SIM approach speed is clamped | SIM's own airframe needs a pass; see below |
| — | Deck loop depth (review R7) | Now off a beginner's path; deepening it is an owner's design call |
| — | A `FIRST_FLIGHT` briefing, a `TURN_TO_DRONE` training step, a full "ghost-lead flies the whole climb" autopilot | Scoped out of v1.11.0 for time; see the v1.11.0 review's frank notes |

**Platform limits and by-design decisions** (#1, #3, #4, #6, #7, #8, #11, #21, #22, #46, #57, #58 and others marked so below) are not defects and are not "open work".

**Closed in v1.10.0:** #40, #41 (partly), #42, #44, #45, #47, #48, #54, #55, #56, #59, #61, #65, #66, #68, #69, #70 — and #71–#81, found and fixed during the release.

**Closed in v1.11.0:** #83–#87, found and fixed during the release — a real pause
menu, "what do I do now" on demand, an ASSIST climb-attitude limit, the "take me
home flies away" bug, and a mixed-units training readout.
Evidence: [`reviews/v1.11.0/`](reviews/v1.11.0/README.md).

---

Honest accounting of current limitations. Items marked **[By design]** are
conscious decisions, not defects — please don't "fix" them without discussion.

> **Numbering note:** two different sections were both numbered `## 1.` until
> v1.9.0. The beginner-cognitive-load entry that occupied the first slot has
> moved to [#61](#61-high-cognitive-load-for-beginners-resolved-in-1100),
> where it belongs alongside the measurements that finally quantified it.

## 1. Browser Web Audio autoplay policy

Browsers suspend `AudioContext` until a user gesture. Audio is unlocked on the
first `keydown` or `mousedown` (`src/main.ts`), and `SoundFX.init()` calls
`ctx.resume()` when suspended. **Consequence:** the game is silent until the
player presses a key. This is unavoidable under current browser policy.

## 2. Euler angles and gimbal lock **[Corrected in v1.9.0 — this entry was stale]**

Orientation uses Euler angles rather than quaternions.

**This entry previously claimed pitch is clamped to ±88° in `applyPitchInput()`
and that loops are impossible. That has been false since v1.7.0.** The clamp was
removed and replaced by `AircraftPhysics.foldPastVertical()`, which re-expresses
the same attitude past the vertical (pitch folds back, heading and roll each turn
half a circle). Loops, Immelmanns and Split-S manoeuvres all work, with no NaN
and no discontinuity — asserted in `BankToTurn.test.ts` ("pitch is never clamped
and passes over the top without NaN").

**What remains true:** yaw is still ill-conditioned very near the vertical, where
`applyPitchInput` divides by `max(0.2, cos(pitch))`. A quaternion rewrite is
still the correct long-term fix and would still ripple through the renderer, HUD
symbology and enemy AI.

**Lesson recorded:** this entry survived two releases after the code changed
underneath it. Standing rule: a release that changes a documented limitation must
update the limitation in the same commit. See the v1.9.0 review's
"Docs vs. code honesty" dimension.

## 3. Frustum clipping is near-plane only

Near-plane clipping (`z ≥ 2.0 m`) is fully implemented **and now covered by
tests** in `src/renderer/VectorRenderer.test.ts`. There is still no side or
far-plane frustum clipping — off-screen geometry is left to the canvas scissor
box. **Consequence:** wasted draw calls when flying close to large meshes. Not
currently a measurable bottleneck versus the terrain grid.

## 4. Enemy cannon fire is hit-scan **[By design]**

When `EnemyAI` establishes a valid guns solution (inside 1600 m and within a 12°
cone, respecting a 1.4 s cooldown), damage is applied directly rather than
spawning enemy bullet entities.

**Consequence:** you cannot dodge rounds already "fired", and there are no
incoming tracers to see. A full enemy projectile subsystem mirroring
`WeaponsSystem` would be more faithful but was judged not worth the complexity
for the tactical value it adds. The alignment and range gating still means
staying out of an enemy's gun envelope is what protects you.

## 5. Bomb and bullet damage models are asymmetric

Bullets damage airborne targets and SAM sites (40 accumulated hits destroys a
site); bombs only damage SAM sites. Bombs cannot destroy aircraft, and neither
can damage the carrier. **Consequence:** friendly fire on your own boat is
impossible.

## 6. Post-processing cost on low-end GPUs

The bloom pass runs at ¼ resolution over 2–3 composite passes. On weak
integrated GPUs at large window sizes this can cost several milliseconds per
frame. **Mitigation:** `PostProcess.nextQuality()` is an adaptive ladder with
hysteresis, wired to a rolling frame-time average, so bloom backs itself off on
slow hardware. There is no longer a display-mode key (see #46).

## 7. Canvas2D `filter` support

The bloom blur uses `ctx.filter = 'blur(2px)'`, unsupported on some older Safari
versions. A 4-tap offset `drawImage` fallback is feature-detected at construction.
**Consequence:** slightly softer bloom on those browsers.

## 8. Device pixel ratio is followed, capped at 2×

The canvas backing store (and the offscreen world layer) is sized to
`CSS pixels × devicePixelRatio`, with the 2D contexts pre-scaled so all layout
code still works in CSS pixels. The ratio is **capped at 2×** so a 3×/4× phone
display doesn't quadruple the bloom pass cost for no visible gain.

This replaces the previous `image-rendering: pixelated` 1:1 backing store,
which was deliberate retro chunkiness but made 10–12px HUD glyphs genuinely
hard to read on every HiDPI screen. The single screen style still carries a
light phosphor trail and vignette without sacrificing glyph sharpness.

## 9. Fixed timestep changes flight feel versus older builds

Controls now run at exactly 120 Hz inside the simulation tick rather than on a
drifting `setInterval(16ms)` with a hardcoded `dt = 0.016`. **Consequence:**
control rates are marginally different (and now correct) compared to pre-fix
builds, and integration error is roughly halved. Behaviour is now identical on
60 Hz and 144 Hz displays.

## 10. Carrier trap tolerances are tight

Recovery requires < 190 m range, 17–30 m altitude and < 95 m/s. Zero fuel on
touchdown is a foam crash landing costing an airframe and 10% hull.
**Mitigation:** the Fresnel meatball, AoA approach indexer and approach data
block appear automatically inside 3 km *while closing on the boat* (the closing
check stops the whole panel popping up during the catapult stroke), and the
flight objective switches to `TRAP ABOARD`. It remains the hardest skill in the
game — by design, since a graded 3-wire trap is worth real score.

## 11. Terrain is analytic, not noise-based **[By design]**

`TacticalTerrain` uses a deterministic sine/cosine canyon profile with bilinear
interpolation rather than Perlin noise or midpoint displacement.
**Consequence:** the map is identical every run and has visible periodicity.
The upside is that it is fully deterministic, trivially testable, and the canyon
corridor is guaranteed navigable — important because terrain masking is a core
mechanic that a random heightfield could break.

## 11b. Three maps, each with its own navigability guarantee

`tactics/TerrainProfiles.ts` holds three analytic maps — BJORNFJORD (the
original), NORWEGIAN SEA and KVITOYA RIDGES — each with its own height
function and SAM order of battle. A scenario names the one it is flown on.

**Consequence:** every map must satisfy the invariants in
`TerrainProfiles.test.ts`: a low continuous corridor wide enough to turn in, a
clear approach tube along the deck centreline, and terrain that can mask a
radar somewhere on the route. NORWEGIAN SEA is exempt from the masking
invariant by design — being unable to hide is its whole identity — which is
why the intro scenario is not flown there: its flight checkout asks the pilot
to descend until the RWR goes silent, and on open water that step can never be
satisfied. Adding a fourth map means adding a fourth set of guarantees, and the
tests will say so.

## 11c. Progress is per-scenario, but there is still no unlock gating

`core/MissionRecords.ts` stores `{best, completions, attempts}` per scenario:
the selector ticks a cleared mission, the debrief compares against that
mission's own best, and `recommendScenario()` marks one pill START HERE.

**Consequence:** the recommendation is a suggestion, not a gate — every
mission is selectable from the first run, including the five-pip ones. That is
deliberate (a player who wants the canyon strike first should get it), but it
does mean a new player can still pick a mission that will beat them.

## 12. Enemy contacts spawn within the canyon corridor

Package `bearingDeg` drives lateral offset and radar plotting, but contacts
always ingress from the `+Z` corridor rather than their true bearing.
**Consequence:** the threat rose bearing is thematic rather than literal. This
prevents contacts spawning buried inside mountain geometry.

## 13. Single aircraft on deck

The deck state machine tracks exactly one aircraft. Spare airframes are a
counter, not a fleet — you cannot have several jets at different readiness
states simultaneously. This limits the depth of the logistics loop.

## 14. Adaptive quality can only back off **[Updated in v1.5.0]**

A rolling frame-time average (EMA) drives `PostProcess.nextQuality()` every
0.5 s, clamped to the ceiling of the one screen style (LOW bloom). The game
lowers bloom on slow hardware and never raises it above that ceiling.

## 15. The deck screen sheds panels on short viewports

`computeDeckLayout()` compresses row height first, but below roughly 700px of
viewport height it starts **dropping** the least important panels (deck plan,
then crew stamina, then the tactical log) rather than drawing them past the
bottom edge. `ORDERS` and `AIRCRAFT TURNAROUND` are marked essential and are
never dropped.

**Consequence:** on a short window you cannot see crew stamina or the deck plan
at all. Panel priorities live in the spec list at the top of
`DeckView.draw()` if that ordering needs revisiting.

## 16. Local storage is best-effort

Six things are persisted, all to `localStorage` under `carrier-vector-1988.*`:
the display mode, the global personal best, the flight assist level, the
per-mission records, the ops tempo and the daily-sortie results. Storage throws in Safari private mode and when
third-party storage is blocked, so every access is wrapped and falls back
silently — the display mode reverts to `MODERN`, the assist level to `ASSIST`,
and the scores read as zero. The mission records are also sanitised field by
field on load, so hand-edited or half-written JSON cannot crash the briefing.

**Consequence:** in those browsers nothing sticks, with no warning, and a
returning player is treated as a new one. Surfacing that would cost more UI
than it is worth.

## 17. The cockpit sheds instruments on small viewports

`solveHudLayout()` places the blocks from the real viewport, but there is a floor
below which they cannot all coexist. Under 1150 px wide the flight checkout
panel is dropped (the coach ticker still carries the current training prompt);
under 560 px tall the systems panel becomes a single bottom strip and the RWR
scope shrinks.

**Consequence:** on a small window you lose the checklist panel and the detailed
systems readout. The thresholds live in `HUD_METRICS` in
`src/renderer/HudLayout.ts`.

## 18. Pointer input is menus, designation and touch mode

Clicking advances the briefing and the debrief, closes the help overlay, and
designates whatever is under the cursor. On a touchscreen the full thumb layout
takes over (see the README). What a mouse still cannot do is fly: there is no
mouse-as-joystick mode, because a pointer-driven flight model is a different
game rather than a port.

## 19. The autopilot cannot ferry the aeroplane home

`AUTOPILOT` now looks ahead. `flight/TerrainFollowing.ts` samples the ground
along the track and asks, for each sample, how high the jet must be *now* to
clear that point by its set clearance when it arrives, and flies the highest
answer - so it climbs a ridge early, crosses with clearance, and sinks back
into the valley behind it rather than cruising at ridge height in plain view.
`G` turns it off.

**What it still cannot do is a large heading change.** Heading in this flight
model comes from the rudder, and the velocity vector does not follow the nose
without a pull the altitude hold will not command; the hold also bleeds its
demand off as bank increases, so a sustained turn is a descending spiral. Push
the autopilot through a hundred and forty degrees at speed and the nose leaves
the velocity vector, alpha departs, and the terrain floor ends up pulling to the
vertical. The recovery assist was built on top of this and had to be narrowed
twice because of it (see §29).

**Consequence:** the autopilot is a good wingman on a bearing and a bad one on
a route. Fixing it properly means an altitude hold with an integral term and a
bank-to-turn law that commands the pull a turn needs - a real rework, with the
whole game's feel downstream of it, so it is recorded rather than rushed.

## 20. Designation is gated on visibility **[Resolved]**

`src/tactics/Visibility.ts` filters the candidate list `TargetTracker` ranks,
by contact class:

| Class | Rule | Why |
| --- | --- | --- |
| Structure | always designatable | it is on the briefing card |
| Aircraft | live line of sight | it moves, so a remembered position is a lie |
| Launcher | line of sight **or** previously discovered | it does not move, and painting you gives it away |

Line of sight is `SensorTacticsManager.checkLOS()`, re-marched at most every
120 ms - with the exception that a contact the tracker has never evaluated is
resolved on the tick it appears, so a newly spawned package is designatable
immediately. The Sidewinder's no-designation fallback takes the same gate; a
deliberate designation is still honoured whatever the terrain does next,
because losing the shot to a hill sliding in at the moment of pressing the
button would read as a broken trigger.

Measured in Chromium on BJORNFJORD: one of three launchers is designatable at
100 m AGL, three of three at 5 km.

## 21. The daily sortie is local-only **[By design]**

There is no server, no account and no global leaderboard. Today's seed is
derived from the date, so everybody flies the same campaign, but the only
record of your result is in your own browser and the only way it travels is
the text card.

**Consequence:** you cannot see where you placed, and a card can be edited
before it is pasted. Both are accepted: a leaderboard needs a backend, and
this project's whole shape is a static bundle with zero runtime dependencies.
The card is the social layer, not a scoring authority.

## 22. Audio spatialisation is stereo, not 3D **[By design]**

World events are panned and attenuated by distance and bearing
(`audio/AudioMix.ts`), but there is no HRTF, no elevation cue, no Doppler and
no occlusion — a SAM launch behind a ridge sounds exactly like one in the open.

**Consequence:** the mix tells you left, right and how far, and nothing else.
`PannerNode` with HRTF would buy elevation and back-versus-front at real CPU
cost on a canvas game that is already spending its budget on the renderer.
Stereo pan plus inverse-square is most of the tactical value for a fraction of
the cost.

## 23. Gun balance changed with the damage model

Rounds now do 25 damage inside a 12 m radius instead of killing outright
inside 18 m, so a fighter takes about four hits and a bomber about nine.

**Consequence:** the cannon is meaningfully harder than it was, and any muscle
memory from an earlier build is wrong. The AIM-9 still kills outright. The
numbers are `WeaponsSystem.GUN_DAMAGE` and `GUN_HIT_RADIUS`, with the
bomber multiplier in `toughnessFactor()`.


## 24. Landing on a phone is still the hard part **[By design, but assisted]**

The recovery assist (`L`, or `RCVY` on a phone, on by default in touch mode)
holds the glideslope and the approach speed on final and hands the aeroplane
back at short final. Lineup is the player's throughout, and so is the trap.

**Consequence:** a touch player now arrives on the slope at the right speed
with the deck in the windscreen, and still has to fly the last seven hundred
metres and catch a wire on a virtual stick. That is the honest trade: the
assist removes the part touch controls cannot do (holding a three and a half
degree slope with a thumb over the altimeter) and keeps the part that is the
game.

## 25. Touch mode is landscape only

`needsRotation()` shows a prompt instead of the cockpit when a touch device is
held upright. At phone-portrait width the instrument solver has nowhere to put
the airspeed and altitude blocks and the pitch ladder collapses to its minimum.

**Consequence:** the game cannot be played one-handed in portrait. A portrait
layout would be a different instrument arrangement rather than a narrower one,
and is not attempted.

## 26. Device detection is a heuristic

`detectScheme()` reads `maxTouchPoints`, `(pointer: coarse)`, `(hover: hover)`
and the viewport's long edge. It will be wrong for somebody — a detachable in
tablet mode, an unusual browser, a desktop with a touch monitor.

**Consequence:** the first thing such a player sees may be the wrong layout.
`K` cycles `AUTO` / `TOUCH` / `KEYBOARD` and the choice is stored, which is the
mitigation rather than a cure; there is no on-screen affordance for it in touch
mode, only in the control reference.


## 27. Contact range tags are dropped when they cannot be placed

`LabelDeclutter` tries four seats around each bracket and gives up rather than
stacking tags or covering an instrument. In a dense merge, the further contacts
lose their range readout.

**Consequence:** the bracket and the lead pipper are always drawn, so no
contact disappears, but you may have to designate one (`T`, or tap it) to read
its range. That is the intended trade: a readable tag on the nearest threat
beats four unreadable ones.

## 28. Red and green are load-bearing **[Resolved]**

`C` cycles the palette. The alternative moves the whole conversation onto the
blue-yellow axis, which deuteranopia and protanopia leave intact: cyan
instruments, amber hostiles, violet keycaps, and the two warning tones
separated by lightness as well as hue. Every colour in every palette clears
4.5:1 on the ground, and a crude deuteranopia simulation in the tests pins the
friendly/hostile separation so a future palette cannot quietly become another
red-green pair.

The classic palette is still the default and still fails that test,
deliberately - it is the game's identity, and it is no longer the only option.
The briefing's secondary row names the alternative directly (`C  try
colour-blind palette`) for as long as `Theme.storedPalette()` reports the
setting has never been touched, and the hint retires itself the instant it
has, even to confirm CLASSIC is what the player wants - closing the
discoverability gap this section used to note.

## 29. The recovery assist flies the ball, not the recovery

`L` engages an assist that holds the glideslope and the approach speed on
final. It deliberately does NOT fly the pattern join, and it deliberately does
not fly the last seven hundred metres.

The handover at short final is a design decision - the trap is the game. The
missing join is not: an earlier version flew the whole recovery from anywhere
and put the jet in the sea with great consistency, for the reasons in §19.
Out of the approach corridor the assist is now a cue (`RECOVERY - GET ASTERN
OF THE BOAT`, and a steer call on final) rather than a hand-over.

**Consequence:** a player who presses it abeam the boat gets directions, not a
lift. Closing this properly means the autopilot rework in §19.

## 30. Boards out is the weapons bay

This airframe has no speedbrake. At idle on a three and a half degree slope it
stabilises at about 170 m/s, which the arresting gear will not take at any
price, because gravity down the flight path cancels the drag. The only drag
device modelled is the weapons bay (`cd0` 0.024 → 0.059), so the recovery
assist opens it above approach speed exactly as a real aeroplane's boards would
be - and closes nothing else.

**Consequence:** the assist overrides the bay state while it is flying, and the
RCS penalty that comes with an open bay applies. Three miles behind your own
boat that does not matter; if a modelled speedbrake is ever added, this should
move to it.

## 31. Rushing a turnaround, and the deck screen, are keyboard-only **[Resolved, with a caveat]**

`R` pushes the crew currently working the aircraft - the mechanic during
`HANGAR_MAINTENANCE` / `DAMAGED_REPAIR`, fuel and ordnance during
`ARMING_REFUELING` - past their ordinary pace: `+20` task progress for `-30`
stamina from each crew member driving that task, gated on their stamina being
above a floor rather than on a per-task lockout (see
`DeckManager.rushTurnaround()`). The hint (`R  RUSH IT`) appears on the deck
screen only while it would do something, and disappears once the crew is
spent - the stamina bars in the crew panel say why, so the hint does not have
to.

**The caveat:** `TouchLayout`'s `DECK` context only ever resolves to `LAUNCH`
or `WORLD` - there is no touch button for this, and none for the fuel/loadout
adjustment keys (`1`-`4`) either. That is not new: the deck screen has never
had full touch parity, it has only ever had "wait, then tap launch." A touch
player therefore cannot rush a turnaround, and does not lose anything they
had before - but closing this gap fully means giving the deck screen real
touch controls, not only this one.

## 32. Onboarding overlaps with live combat **[Resolved in v1.5.0]**

~~Resolved via `TRAINING_SORTIE` in `src/core/Scenarios.ts`.~~

**Reopened 2026-09-20 during the v1.5.0-dev review.** `TRAINING_SORTIE` was
built correctly (`noSamSites: true`, `combatShielded: true`, zero hostiles) —
but **no player is ever routed to it.**

`recommendScenario()` (`src/core/Scenarios.ts:691-699`) selects the first-flight
mission by searching for `setup.showTrainingChecklist`:

| Scenario | `showTrainingChecklist` | Hostiles | SAMs |
| :--- | :---: | :---: | :---: |
| `CARRIER_DEFENSE` | **`true`** (line 277) | endless waves | **yes** |
| `TRAINING_SORTIE` | **`false`** (line 586) | none | none |

So every first-time pilot is still sent into the endless-waves combat mission,
exactly as this issue originally described. The tutorial exists and is
unreachable.

**Fix:** add an explicit `isFirstFlight` flag to `TRAINING_SORTIE` and match on
it, plus a regression test asserting
`recommendScenario(emptyRecords()).id === 'TRAINING_SORTIE'`. See
[`docs/reviews/v1.5.0/RECOMMENDATIONS_AND_ROADMAP.md`](reviews/v1.5.0/RECOMMENDATIONS_AND_ROADMAP.md) T0-1.

**Process note:** this issue was closed on the basis that the feature was
*built*, not that it was *reachable*. Verify user-facing outcomes, not
implementation existence, before closing.

## 33. Mute cockpit audio and visual attention split **[Resolved in v1.4.0]**

Resolved via `CockpitVoiceSystem` in `src/audio/CockpitVoiceSystem.ts`. The browser's native `window.speechSynthesis` API synthesizes 1980s military avionics voice warnings ("Bitchin' Betty") for `MISSILE LAUNCH`, `PULL UP`, `STALL WARNING`, and `BINGO FUEL`. Alerts are managed via a priority queue with 4.0s de-bounce lockout per warning type, keeping the pilot's visual attention focused on the boresight.

## 34. Fixed 60° forward FOV blindfold in turning dogfights **[Resolved in v1.4.0]**

Resolved via `PadlockCamera` in `src/renderer/PadlockCamera.ts`. Pressing `V` in cockpit view slaves camera line-of-sight tracking to the designated target contact. The look-at orientation is constrained within realistic canopy geometry (±110° azimuth, -30°/+60° elevation) and smoothly transitions via 250ms ease-out cubic interpolation.

## 35. Sterile target destruction feedback and lack of kinetic "Juice" **[Resolved in v1.4.0]**

Resolved via `VectorDebrisSystem` in `src/renderer/VectorDebris.ts`. Exploding enemy aircraft, SAM radars, and player airframes shatter into 10–16 physics-driven wireframe line segments with outward blast velocity (15–40 m/s), gravity, drag, terrain collision bouncing, and 1.2s phosphor alpha decay. Memory allocation is completely zero-overhead through pre-allocated fragment pools.

---

# Defects Found in the v1.5.0-dev Review (2026-09-20)

Full analysis: [`docs/reviews/v1.5.0/`](reviews/v1.5.0/COMPREHENSIVE_GAME_REVIEW.md)

## 36. Tutorial teaches the wrong autopilot key **[Resolved in v1.5.0]**

`TRAINING_SORTIE` instructs the player to press `[A]` for autopilot in four
places (`src/core/Scenarios.ts:599, 600, 633, 634`). `[A]` is bound to **roll
left** (`Controls.ts:33`); the flight-assist key is `[F]` (`Controls.ts:53`).

**Consequence:** a new pilot who obeys the tutorial rolls into the fjord. The
one mission designed to build confidence punishes obedience.

**Root cause:** `Controls.ts` is the documented single source of truth for
keybindings, but mission prose hardcodes key names as plain strings, outside
that guarantee. **Fix the class, not just the instance:** resolve every
user-facing key name from `CONTROL_SCHEMA`, and add a test asserting that every
key string in `Scenarios.ts`, `Tutorial.ts` and `HUD.ts` exists in the schema
for that context.

## 37. Autopilot tutorial step validates nothing **[Resolved in v1.5.0]**

`src/core/Scenarios.ts:635` — `isComplete: (s) => s.airSpeed > 90 && s.missionSeconds > 20`.
The step passes on a timer and then announces `"AUTOPILOT VERIFIED"` to a player
who never engaged the autopilot. A tutorial that validates nothing teaches
nothing, and a tutorial that lies destroys trust in every later instruction.

## 38. No defensive counterplay against SAM missiles **[Resolved in v1.5.0]**

There are **zero countermeasures in the codebase** — no chaff, flare, ECM or
decoy. `grep -rn "chaff|flare|countermeasure" src/` returns nothing.

Worse, the SAM missile uses **pure pursuit with an unbounded turn rate**
(`src/tactics/RadarLOS.ts:337-344`): its velocity is re-pointed directly at the
aircraft every tick, with no lead, no G limit, no energy bleed and no seeker
FOV. **It is mathematically undodgeable by manoeuvring.** The only escapes are
breaking line-of-sight against terrain, or surviving the 10-second fuel burnout.

**Consequence:** every defensive reflex a player brings from the genre — break
turn, notch, split-S — is silently useless, and the peak-tension moment of the
game resolves as a coin flip on terrain proximity.

**Fix:** clamp the missile turn rate (~25 deg/s) and use lead pursuit (~30 lines);
add chaff/flares on `[X]` with aspect-dependent break probability.

## 39. The SEAD mission ships without SEAD weapons **[Resolved in v1.5.0]**

`IRON_HAND` (`src/core/Scenarios.ts:404`) asks the player to roll back a SAM
belt. The entire anti-SAM arsenal is:

* **20 mm Vulcan** — 40 hits inside an **8 m radius** (`Weapons.ts:337-348`)
* **Mk.82 iron bomb** — 180 m splash (`Weapons.ts:437-446`)
* **AIM-9** — cannot damage SAMs at all

There is no anti-radiation missile, no standoff weapon, and no fire-support
call. The player must enter the 5,000 m envelope of an undodgeable missile
(issue 38) to deliver an unguided bomb. This is the game's core difficulty
spike, and it is caused by missing equipment rather than intended challenge.

**Fix:** add an AGM-88 HARM that locks only SAMs in `SEARCH`/`TRACK`/`LAUNCH`
state and goes ballistic if the site goes `SILENT`. The four-state radar machine
this requires already exists in `RadarLOS.ts:307-325`.

## 40. Pitch axis defaults against genre convention **[Resolved in 1.10.0]**

> **v1.10.0:** the in-context offer the fix below describes now exists. `PitchStruggleDetector` (`src/core/StruggleDetector.ts`) watches for short alternating pitch stabs; four inside 12 s, from a pilot who has never touched the stick setting, produce one callout: *STICK FEELS BACKWARDS? PRESS [I]*. Offered once per session. The default stays UP = climb (the briefing offers the flip before the first flight, as before).

`Controls.ts:31-32` binds `ArrowUp` to **pitch up**. The flight-sim convention
(MSFS, X-Plane, DCS, IL-2, Ace Combat) is `ArrowUp` = stick forward = **nose
down**. A toggle exists on `[I]` with excellent labelling
(`STICK: REAL (UP = DIVE)` / `STICK: DIRECT (UP = CLIMB)`), but it defaults to
the non-standard mode and is one of 40+ flat keybindings.

**Fix:** ask once on the briefing screen in behavioural language
("PULL BACK TO CLIMB" vs "PUSH UP TO CLIMB" — never the word "inverted"), and
detect rapid pitch-axis reversals in the first 60 s to offer the fix in context.

## 41. No key remapping **[Partly resolved in 1.10.0 — remap UI stays P2]**

> **v1.10.0:** the practical harm - WASD scattered on AZERTY/QWERTZ - is fixed. The six stick keys (W A S D Q E) are now read by physical position (`KeyboardEvent.code`, see `Controls.normalizeKey`), so they sit under the same fingers on AZERTY, QWERTZ and Dvorak. Mnemonic shortcuts (M, H, …) keep their labels. A remapping screen is still not built; build it if pilot feedback asks.

`CONTROL_SCHEMA` is a `readonly` const consumed directly, with no override
layer. **Consequence:** `WASD`+`QE` occupy different physical positions on
AZERTY and QWERTZ keyboards, so the game is measurably harder outside
QWERTY regions, and left-handed or limited-mobility players have no recourse.

## 42. Incoming missiles are effectively invisible **[Resolved in 1.10.0]**

> **v1.10.0:** each missile in flight draws a red chevron on the steering ring round the boresight, at its bearing relative to the nose, labelled `MISSILE LEFT / RIGHT / AHEAD / BEHIND` - in every HUD density, including FIRST_FLIGHT, which hides the radar. The banner keeps the time to impact.

The SAM missile is drawn as a single 8-metre line segment
(`src/core/GameLoop.ts:2310-2316`). At its 5,000 m launch range that is
sub-pixel. There is no time-to-impact readout and no directional threat caret.

**Consequence:** the player is told they are in danger without being shown the
danger — anxiety without agency, which is the precise recipe for quitting.

## 43. Death has no post-mortem **[Resolved in v1.5.0]**

On destruction the player is given no causal explanation: not the killer, the
range, the mistake, nor what to do differently. Unexplained death is the leading
rage-quit driver in combat games, and every number needed for the explanation is
already present in the simulation state.


---

# Resolution notes and new limitations (v1.5.0)

**#32 / #36 / #37** - `TRAINING_SORTIE` carries an explicit `isFirstFlight` flag and
`recommendScenario()` matches it; the cards say `[F]`; a real MiG-23 drone spawns; the autopilot
step checks `flightAssistMode === 'AUTO'`. Two guards in `Scenarios.test.ts` fail if a mission names
a key the schema does not bind, or the wrong key for the action described. #32 had been closed in
1.4.0 because the feature was *built*, not because it was *reachable* - verify the outcome, not the
implementation.

**#38** - `tactics/MissileGuidance.ts` (lead pursuit, 0.25 rad/s) and `flight/Countermeasures.ts`
(chaff). Chaff **always** works, by design: `ThreatLevel.ts` forbids a second, hidden difficulty
table, and the skill lives in the visible guidance law. The tuning is asserted in
`MissileGuidance.test.ts`; retuning the constant without re-measuring the envelope fails.

**#39** - The AGM-88 HARM. It is *not* a cure-all: it locks only a radiating site, and if that site
goes SILENT mid-flight the round flies ballistic. The player's HARM turn limit (0.4 rad/s) is
deliberately more forgiving than the SAM's - asymmetry in the player's favour is intended.

**#40** - The briefing offers the stick flip once (`I`). The default is still `UP` = climb; an
unprompted first-run *question* was judged one screen too many.

**#42** - Time-to-impact and a decoy cue landed. The missile is still drawn as a short line
(34 m) and there is no directional threat caret; at 5 km it remains small.

## 44. Chaff and the HARM have no touch controls **[Resolved in 1.10.0]**

> **v1.10.0:** `TouchLayout` has a chaff button above TGT under the right thumb (amber when a missile is inbound) and a fourth weapon slot for the HARM. Both are in the overlap / viewport / centre-keep-out test matrix for all seven handsets, and the browser harness taps chaff on 844×390 and 640×360 phones.

The touch layout has three weapon buttons and no room for a fourth or a chaff button without
re-solving `TouchLayout` and its hit-test priority order. A touch pilot can neither press `X` nor
select the HARM. Same shape as #31 (deck touch parity), recorded rather than rushed.

## 45. PRO HUD weapon-chip click regions are fixed-width **[Resolved in 1.10.0]**

> **v1.10.0:** chips are fixed-width and come from one solver (`HudLayout.proChipRects`) that the renderer and the hit-tester share; so do the corner buttons (`cornerButtonRects`), which were also hit-tested at different x than drawn. The click areas of the deleted keycap strip, which had become invisible traps, are gone. See #75, #76.

The ARCADE bar's geometry is now one solver shared by renderer and hit-tester. The PRO systems
panel is not: its chips are drawn at measured text width but hit-tested at a fixed 68 px, so a long
label can desynchronise them. Fix the same way (`solveArcadeBar`'s approach).

## 46. `P` and the CLEAN / RETRO looks are gone **[By design]**

One screen style, deliberately. A stored value from the old ladder is ignored and the game boots into
MODERN. RETRO's per-stroke shadow cost ~7 ms/frame at 1600x900 and its 0.7 vignette hurt legibility.

## 47. The HARM's kill radius and range are tuned by reasoning, not by playtest **[Verified by simulation in 1.10.0]**

> **v1.10.0:** a stand-off engagement now runs through the real game loop - fired inbound from 7 km, the HARM kills a radiating site (`GameLoop.smoke.test.ts`). A human feel pass is still welcome but no longer blocks anything.

`HARM_TUNING` (600 m/s, 15 s burn, 20 m hit radius) has unit tests but has not been flown by a human
against the SHATTERED_RIDGE belt. Expect a balance pass.

## 48. Not shipped from the v1.5.0 plan **[Mostly resolved in 1.10.0]**

> **v1.10.0:** struggle detection shipped (#40), and progressive disclosure shipped as the FIRST_FLIGHT HUD and brief deck (#61). Still not built: cruise-missile support (`Z`), a remap screen (#41).

Cruise-missile fire support (`Z`), progressive control disclosure by mission, struggle detection
(auto-offering the stick flip after repeated pitch reversals), key remapping, and the autopilot
coordinated-turn rework (#19). Cut deliberately when the scope was simplified.

---

# Resolution notes and new limitations (v1.6.0)

Issues #49-#55 were raised by the second human playtest. Status after this release:

| # | Issue | Status |
| --- | --- | --- |
| 49 | Banking does not turn the jet | **Fixed** - and the root cause was a mirrored orientation basis, not just a missing coupling |
| 50 | Pitch clamped at 88 degrees, no loops | **Fixed** - pitch folds through vertical |
| 51 | RWR mistaken for a radar | **Fixed** - tactical radar with carrier, bandits, objectives, SAM arc |
| 52 | Instant cut to the deck on death | **Fixed** - 2.6 s slow-motion sequence with the cause |
| 53 | Fjord is a 1-D corridor | **Open, deliberately** - see below |
| 54 | No contextual guidance | **Partly fixed** - the coach existed; it now coaches the attack and the tail |
| 55 | No sense of winning | **Partly fixed** - first-time milestones; no new mission |

## 49. Banking did not turn the jet **[Fixed in 1.6.0]**

Two defects stacked. (1) `AircraftPhysics.upVector`, and the renderer's `basisVectors` that duplicates
it, used the roll-*left* sign for `up` and for two components of `right`, but the roll-*right* sign for
`right.y`. The basis was not orthonormal (`right · up = -sin(2·roll)`), so at 46 degrees of right bank
lift pointed up-and-left: the flight path curved the wrong way, and the camera, which projects onto the
same vectors, was sheared. (2) Nothing coupled bank into heading, so even with the lift right the nose
never followed. The fix is one consistent rotation, the body-rate pitch mapping, and directional
stability. **Lesson:** the unit tests only checked the basis against *itself*, so a sign error that was
consistent between two copies of the formula passed for months. It is now asserted orthonormal.

## 50. Pitch clamp **[Fixed in 1.6.0]**

The clamp is replaced by a fold: past +-90 degrees the pitch is reflected and heading and roll turn half
a circle, which is the same attitude. The jet is heavy (thrust-to-weight 0.91 at full afterburner), so a
loop from 260 m/s crosses the top at ~90 m/s. It works; it is not graceful. See #56.

## 51. RWR as radar **[Fixed in 1.6.0]**

The scope is a heading-up tactical radar (`RadarMath.ts`, range 12 km). Contacts beyond range are
pinned to the rim and drawn hollow. The scope shows the *nearest ground distance*, not altitude: a
bandit 3 km above you looks the same as one at your level. Height is the next thing to add.

## 52. Death cut **[Fixed in 1.6.0]**

`replaceAirframe` now starts a `dying` state (2.6 s, world at 0.3x, controls dead, cause on screen)
and `finishAirframeLoss` does what the old function did. The camera stays in the cockpit; there is no
outside "kill cam". A terrain death zeroes the velocity so the wreck does not slide.

## 53. 1-D fjord **[Open, deliberate]**

The FJORD is documented as "preserved exactly" and the strike mission's SAM masking is balanced on it.
Now that the jet turns, the corridor plays as a slalom rather than a hallway, which was the actual
complaint. `OPEN_SEA` and `SHATTERED_RIDGE` already give open air. A branching archipelago map is the
right answer and is a v1.7 item, because a new map means re-balancing every scenario that names it.

## 54. Guidance **[Resolved in 1.10.0]**

> **v1.10.0:** the go-here cue: a chevron on a ring round the boresight pointing at the boat when the jet should be going home (recovery phase, bingo fuel, heavy damage), or at a standing hardened target - `BOAT 4.2 KM · TURN LEFT`.

The review said no hints existed; a priority-ranked coach ticker did (`Tutorial.ts`). What was missing
was *offensive* coaching, which is now in. Still not done: nothing prompts the player to *land* except
the final approach aids, and there is no first-flight guided "go here" arrow on the HUD.

## 55. Winning **[Resolved in 1.10.0]**

> **v1.10.0:** completing the training sortie is `WINGS EARNED`, and it is also the graduation from the FIRST_FLIGHT HUD to the full instruments - the debrief says so.

`Milestones.ts` pays out four first-times once each. There is still no new "first sortie" mission with
a fanfare debrief; `TRAINING_SORTIE` already exists and is shielded. A qualification debrief ("WINGS")
is the obvious next reward.

## 56. Turns are energy-limited, not snappy **[Resolved in 1.10.0 — see #65, #71]**

> **v1.10.0:** superseded by #65 and #71.

Measured through the real game loop: about 9 degrees/s from a held bank, ~19 s for a sustained 180 at
full afterburner, ending near 96 m/s. The assist holds the wing at its limit, and the airframe's induced
drag multiplier above 1.5 g (kept because it makes hard turns cost energy) does the rest. This is the
first thing to tune with a stick in hand: a lower assist alpha target trades turn rate for speed.

## 57. Turn assist changes MANUAL **[By design]**

`turnAssist = 1` is set in the game loop, so a bank-and-pull is gentler and harder to stall than the raw
model, and an upright bank stops at 75 degrees. The raw model (`turnAssist = 0`) is what the physics
tests exercise and is unchanged. There is no setting to turn the assist off in the game yet.

## 58. Milestones are per browser **[Known]**

They live in `localStorage` (`carrier-vector-1988.milestones`). A cleared store or a new browser earns
them again. Blocked storage means they repeat every session, which is the chosen failure mode.

## 59. The guns warning is a callout, not a sound **[Resolved in 1.10.0]**

> **v1.10.0:** `SoundFX.playGunsTracking` - a rising three-pip warble, panned toward the shooter, distinct from the master caution and the missile lock tone. Played when a fighter first gains a solution.

`GUNS TRACKING` is on the callout channel only. A dedicated lock-tone for "a fighter has a solution on
you" would read faster than text at the moment the pilot is looking at the target.

## 60. Beginner Assistance & Entertainment Balance **[Fixed in 1.8.0]**

In response to playtesting feedback indicating high cognitive load, lack of kinetic reward, and targeting friction:
- **Target Designation Friction:** Auto-acquisition implemented in `TargetTracker` for initial contacts upon takeoff in `ASSIST` and continuous pursuit in `AUTO`.
- **Sensory & Visceral Feedback:** Camera trauma on kill confirmation increased by 3.8×, vector debris fragments boosted to 28 at 50 m/s dispersal, and gold halo glow applied to kill announcements.
- **Flight Envelope Safety:** Anti-stall cruise throttle protection added in `ASSIST` mode when speed decays below 130 m/s without pilot braking.
- **HUD Decluttering:** Percentage fuel readout (`FUEL 86%`) in `ARCADE` mode.
- **First Flight Guidance:** `TRAINING_SORTIE` automatically recommended on launch for first-time pilots.


---

# Found by the v1.9.0 browser playtest

The first review to run the live build in a real browser and inspect rendered
frames. Everything below is measured, not inferred — see
[`docs/reviews/v1.9.0/PLAYTEST_EVIDENCE.md`](reviews/v1.9.0/PLAYTEST_EVIDENCE.md).

## 61. High cognitive load for beginners **[Resolved in 1.10.0]**

> **v1.10.0:** a new pilot flies the FIRST_FLIGHT HUD - three optional regions (horizon, armed-weapon chip, one hint line) instead of nine, with a single steering cue replacing the compass and radar - and sees the brief deck: four panels instead of eight. Both graduate automatically after the first completed mission; `U` steps through FIRST FLIGHT / ARCADE / PRO at any time and the choice is remembered. Budgets are enforced by `HudDensity.test.ts`. The briefing screen is the remaining dense screen (v1.10.0 roadmap N1).

The long-running entry, now with numbers behind it. Measured at 1440×900,
default settings: **27 simultaneous draw regions, 33 labelled values, 29 key
bindings** in the help overlay, 8 deck panels with ~35 numbers, and 14 distinct
keys shown on the briefing screen before the player has flown.

The root cause turned out not to be density alone. **Four pairs of HUD elements
were being drawn into the same rectangle** (#62), so the screen was not merely
full — it was printed on top of itself.

**Fixed in v1.9.0:** all four collisions (#62), the horizon restored to ARCADE
(#63), the false launch hint (#64), shorter control labels.
**Still open:** the element count itself. The fix is
[R1, the `FIRST FLIGHT` HUD](reviews/v1.9.0/RECOMMENDATIONS_AND_ROADMAP.md#tier-1--the-big-one) —
show five things, hide the other twenty-two, on by default until the first
sortie is complete.

**Prior mitigations that remain valid:** v1.7.0 radar sizing; v1.8.0
`TRAINING_SORTIE` routing, auto-acquisition, anti-stall floor, `FUEL %` readout.

## 62. Four HUD element pairs shared the same pixels **[Fixed in 1.9.0]**

All unconditional, all at the default desktop size, all present since at least
v1.7.0:

| Collision | Ranges (at 1440×900) |
| :-- | :-- |
| Objective strip ∩ compass tape | 54–108 vs. 76–108 |
| Pill bar ∩ assist annunciator ∩ keycap strip | 848–882 vs. 848–870 vs. ~873–883 |
| Score chip ∩ top-right button row | 18–44 vs. 16–44 |
| Help-overlay FLIGHT labels ∩ SYSTEM keycaps | unbounded `fillText` past `colW` |

**Cause:** the project built pure layout solvers (`HudLayout`, `DeckLayout`,
`TouchLayout`) precisely so that "no two instruments overlap" would be testable,
then positioned these seven elements with hand-written offsets that bypassed
them. `HUD.instrumentBoxes()` even *reserved* the annunciator band — but only for
floating-label decluttering; the pill bar and keycap strip never consulted it.

**Fix:** `HUD.BAND` and `HudLayout.BOTTOM_STACK` are now derived — each band's
top is its predecessor's bottom plus a gap — and exported as `bandRects()` /
`bottomStackRects()`. Six tests in `HudLayout.test.ts` assert both stacks are
disjoint at every viewport height and touch reserve.

## 63. The default HUD had no attitude reference **[Fixed in 1.9.0]**

`drawPitchLadder` returned immediately in ARCADE (the default), which removed the
zero rung — the artificial horizon — along with the ladder. In a 75° bank with
the real horizon off-screen, the only attitude cue on the entire display was the
three-stroke waterline glyph.

This is the direct cause of *"it is hard to understand how to control the jet"*:
a held bank and back-stick from a nose-high state produces almost no heading
change (#65), and the explanation — a 36° nose-up attitude — was not displayed
anywhere.

**Fix:** `HUD.drawArcadeHorizon()` — the ladder's zero rung and a signed pitch
number, using the same exact `fov · tan(δ)` projection, pinned and dimmed when
the horizon leaves the glass. Nothing else from the ladder.

## 64. `TOO FAST FOR THE TRAP` fired on every launch **[Fixed in 1.9.0]**

The rule was `distanceToCarrier < 2500 && airSpeed > 95`. A catapult shot leaves
the boat fast, from zero range, so both clauses are true by construction for the
first seconds of every launch in every scenario. Measured 4 s after the training
cat shot at 201 m altitude: the objective strip read `CLIMB TO 2,500 FT` and the
hint 60 px below it read `REDUCE TO BELOW 90 M/S`. Obeying it stalls the jet.

**Fix:** the rule now also requires `closingOnCarrier` (supplied from
`HUD.isOnApproach`), `altitudeAgl < 400` and a non-climbing vertical speed. Two
regression tests cover the launch and departure cases.

## 65. Turn rate and roll feel **[Resolved in 1.10.0]**

> **v1.10.0:** the roll-easing idea below was measured and dropped (the roll already reaches its cap in ~0.45 s, normal arcade feel). The real causes were #71 (stability on the wrong axis) and an under-lifted airframe. The ARCADE tempo now flies a bigger wing (`PacingSpec.liftScale` 1.7, lift and drag both scaled); SIM keeps the original. Held-bank turn in the running game: **12.3 °/s with the nose at +6°** (was 7.2 °/s with the nose climbing to 29°).

Supersedes and quantifies #56. Measured in-browser, held input, 200 m/s at
2500 m:

| Input | Assist | Turn rate | 180° reversal |
| :-- | :-- | --: | --: |
| Bank only | ASSIST | 7.2 °/s | ~25 s |
| Bank + pull | ASSIST | 9.5 °/s | ~19 s |
| Bank + pull | MANUAL | 10.3 °/s | ~17 s |

Bank-and-pull **is** faster than bank alone, so the control reference's "hold W
to tighten" is correct — this was checked because it felt wrong in play and the
measurement said otherwise.

Two open problems:

1. **Roll snaps to the 75° cap instantly** and pins there. There is no
   proportional bank feel and no way to hold an intermediate angle.
2. **From a nose-high, energy-bleeding state** — exactly the state a beginner is
   in off the catapult with the throttle parked at 150% AB (#66) — eight seconds
   of held bank and back-stick produced **2° of heading change**. This is
   aerodynamically correct (the turn is going into the vertical plane) but reads
   as broken input.

**Not changed in v1.9.0**, deliberately: turn rate is the number every mission's
timing budget is built on. Three options in
[R2](reviews/v1.9.0/RECOMMENDATIONS_AND_ROADMAP.md#r2--turn-rate-and-roll-feel);
the recommended one (ease the roll to the cap over ~0.4 s) changes no mission
timing.

## 66. The anti-stall throttle floor never retards **[Resolved in 1.10.0]**

> **v1.10.0:** in ASSIST, afterburner is a held boost: released above 180 m/s, it returns to military power within about a second. A throttle the pilot set below 100% is never touched; MANUAL keeps a latched burner.

`FlightAssist.ts` raises throttle to 0.7 when airspeed decays below 130 m/s, and
nothing ever lowers it. Measured: a new pilot who touches no throttle key flies
the entire sortie at **150% afterburner**, burning 138 L in 25 s while climbing
steeply — which is how they arrive in the nose-high state of #65.

Fix is symmetrical to the floor that already exists: in `ASSIST`, with no pilot
throttle input and airspeed above ~200 m/s, ease the demand back toward 0.85.
See R3.

## 67. The training sortie damaged the player's carrier **[Fixed in 1.9.0]**

`TRAINING_SORTIE` declares `combatShielded: true`, a tagline of *"Zero combat
hostiles"* and a loss condition of *"Running out of fuel or ditching in the
fjord"*. Measured on a stock first run with the player idle on the deck:
**hull 100% → 85% at T+20s**, logged as
`WARNING: MiG-23 STRAFING RUN ON FLIGHT DECK!`.

`combatShielded` was consulted in four places in `GameLoop.ts`, all protecting
the *player's aircraft*. `DeckManager.update()` ran the package-reaches-the-
carrier damage path without ever checking it.

**Fix:** `DeckManager.combatShielded`, set from the scenario in `applyScenario`.
A shielded package logs a completed drone pass and deals no damage. Three
regression tests.

## 68. The deck screen contradicts itself **[Resolved in 1.10.0]**

> **v1.10.0:** the bomb contradiction was a real **free-ordnance bug** (#73), now fixed; the payload panel shows `NONE ABOARD` / `MAGAZINE SHORT` in caution. A shielded scenario's contact panel reads `TRAINING RANGE · TARGET DRONE` in the neutral colour, and the cockpit tags it `DRONE`.

Two contradictions visible in a single frame on the training mission:

* `NEXT SORTIE PAYLOAD` offers `MK.82 IRON BOMB 2 / 4` while `STRIKE GROUP
  STATUS` lists stock `0` — and the scenario's `inventory` declares
  `ironBombs: 0`.
* `EARLY WARNING RADAR` labels the training drone `1 INBOUND / FIGHTER 0:18` in
  red, on the mission that promised zero hostiles. `DeckManager` now knows about
  `combatShielded`, so labelling it `TARGET DRONE` in a neutral colour is a
  small change.

See R6.

## 69. The desktop deck screen is worse than the phone one **[Resolved in 1.10.0]**

> **v1.10.0:** `DeckView.deckPanelSpecs` - a FIRST_FLIGHT pilot sees the BRIEF deck (orders, turnaround, contacts, log) on any screen; the full deck (payload, stocks, deck plan) follows the HUD density. The crew panel is folded into one turnaround line.

Desktop: 8 panels, ~35 numbers, 4 progress-bar groups. Phone landscape: 4 panels
and one large `LAUNCH` button, from the same code via `DeckLayout`'s priority
shedding. The phone version is clearer for a first-time player **on any device**.

The simplified deck screen this game needs already exists and already ships — it
is just gated on viewport size instead of on player experience. See R5.

## 70. `BankToTurn.test.ts` does not cover the saturated case **[Resolved in 1.10.0]**

> **v1.10.0:** "coordinated turning (v1.10.0)" adds full-deflection sustained bank-and-pull, nose-on-flight-path and sideslip tests, and an ARCADE-vs-SIM airframe comparison.

The test *"bank and pull swings the nose round faster than the bank alone"*
exercises 0.6 stick deflection for 6 s from 220 m/s, where the property holds.
The game gives 1.0 deflection from 180 m/s decaying to 126 over 8+ s from a
nose-high start, where heading change falls to ~0.25 °/s (#65).

Not a false test — an incomplete one. 921 green tests made the gap invisible.
Add the saturated case and assert whatever the intended behaviour actually is.


---

# Found and fixed in v1.10.0

Each of these was found while implementing the v1.9.0 review, by measuring or by
the browser harness - none appear in any review. Evidence:
[`reviews/v1.10.0/IMPLEMENTATION_REPORT.md`](reviews/v1.10.0/IMPLEMENTATION_REPORT.md) §3.

## 71. Directional stability acted about the wrong axis **[Fixed in 1.10.0]**

The weathervane term rotated the nose about the WORLD vertical toward the
velocity heading. Wings-level that is correct; banked it is not, because the
airframe's yaw axis is tilted and the restoring moment is mostly nose-down.
Measured: 16 s of held bank left the nose 43° above the horizon while the jet
descended 146 m - a sideslip nothing corrected, and the "climbing spiral" behind
*"I pull and nothing happens"*. Now acts on sideslip β about the body yaw axis
(`AircraftPhysics.update`), identical wings-level.

## 72. The recovery assist could not fly its own approach **[Fixed in 1.10.0]**

Three compounding faults: a pure-integral autothrottle (no anticipation); an
altitude law damped toward zero *attitude*, which settles below any slope that
needs a nose-up attitude; and a fixed 70 m/s approach speed the original airframe
could only fly at 15.5° AoA (past the limiter). On SIM it handed over 34 m low at
95 m/s; on the ARCADE airframe it flew into the sea 900 m short. Now: rate-damped
autothrottle (`speedRate`), flight-path (γ) damping wings-level, a glideslope
feed-forward (`NavTarget.pathAngle`), and an approach speed derived from the
airframe's on-speed AoA (`AircraftPhysics.onSpeedApproachSpeed`). Hands over
within 1 m of the slope on both airframes.

## 73. Free ordnance from an empty magazine **[Fixed in 1.10.0]**

Launch clamped the ship's stock at zero but handed the jet its full planned
loadout. `DeckManager.loadableLoadout()` caps the plan at the magazine; launch
deducts and flies exactly that, and logs `MAGAZINE SHORT`.

## 74. The turnaround panel's stores rows were never visible **[Fixed in 1.10.0]**

The progress bar was pinned to the panel's bottom edge and the LOADED rows were
laid out below it - off the panel, on every desktop size.

## 75. ARCADE pill clicks landed 104 px left **[Fixed in 1.10.0]**

Renderer and hit-tester passed different pill flags (the hit-tester omitted the
chaff pill). Both now read `HudLayout.arcadeBarFlags`, and a test pins every
clickable rect to its drawn rect.

## 76. PRO buttons mis-hit; deleted strip left click traps **[Fixed in 1.10.0]**

See #45. Shared `cornerButtonRects` / `proChipRects`.

## 77. TERRAIN alarm on every catapult climb-out **[Fixed in 1.10.0]**

The terrain floor's height-only partial pull annunciated as a red
`TERRAIN — AUTO PULL-UP`. Now announced only when sinking or at the hard floor.

## 78. Two orders at once on phones **[Fixed in 1.10.0]**

Phones default the recovery assist on, and its JOIN cue (`GET ASTERN OF THE BOAT`)
showed from take-off, over `CLIMB TO 2,500 FT`. The JOIN cue now shows only when
the jet should be going home (`GameLoop.isHomeward`).

## 79. Any exception froze the game silently **[Fixed in 1.10.0]**

The frame body scheduled the next frame on its last line. Now one bad frame is
logged and skipped; 30 consecutive failures stop the loop and show a crash screen
with Reload and a pre-filled report (`GameLoop.onFatalError`).

## 80. Returning pilots: START HERE on one mission, FLY on another **[Fixed in 1.10.0]**

`start()` now always opens on `recommendScenario`, not only for new pilots.

## 81. Touch readouts drifted into the objective strip **[Fixed in 1.10.0]**

Touch-mode bottom readouts were measured up from the tallest thumb control; they
now sit in the free bottom-centre gap (`HudReserve.bottomCentre`).

## 82. SIM's approach speed is clamped below its own on-speed speed **[Open]**

The original airframe's on-speed approach speed (1 g at 8.1° AoA) is about
100 m/s, above what the wires accept (< 95 m/s). The recovery assist clamps it to
88 m/s, so on SIM a correct approach reads slightly slow on the AoA indexer
(~9.6°). ARCADE (the default) is on-speed. The honest fix is a SIM airframe pass
(roadmap N3).

## 83. No pause menu; ESC only closed the control reference **[Fixed in 1.11.0]**

Once airborne, there was no way to see the current state, pause, or get back to
mission select without finishing or dying. A beginner playtest asked for it
directly: *"I should have menu to click and select what to do."* `PilotMenu.ts`
and `PilotMenuView.ts` add a real pause menu — RESUME, LET THE AUTOPILOT FLY,
TAKE ME HOME, SHOW ALL CONTROLS, INSTRUMENTS, SOUND, RESTART THIS SORTIE and
MISSION SELECT — opened by `ESC`, a corner `MENU (ESC)` button, or the existing
touch `MENU` control (which used to just open the raw help overlay). It pauses
the simulation and restates the current objective in plain words.

## 84. A beginner following the training card's own instruction could not tell what to do next **[Fixed in 1.11.0]**

Measured: a hands-off pilot's objective stayed on `CLIMB TO 2,500 FT` for 90
seconds with no escalation, no menu, and no way to ask for help. The pilot menu
above answers "what do I do now" on demand (`plainInstruction()` in
`PilotMenu.ts`), and offers to let the autopilot fly the boring parts.

## 85. ASSIST had no pitch-attitude limit; a held climb reached 85° and stalled **[Fixed in 1.11.0]**

Measured in a real browser: holding `W` (exactly what the training card says
to do) took the nose to 85° and airspeed down to 79 m/s in six seconds, because
the stall limiter is unloaded in a zoom climb and never engaged. `ASSIST` now
fades a held pull out approaching ~35° of pitch and gently pushes back over it
(`FlightAssist.climbLimited`, `ASSIST_TUNING.maxClimbPitch`). MANUAL is
untouched — loops and full aerobatics are one key away.

## 86. "Take me home" could fly the jet away from the carrier forever **[Fixed in 1.11.0]**

Measured: a pilot 640 m astern of the carrier, pointed almost directly away
from it, pressed `L` under the autopilot and was flown to 7.9 km out over 80
seconds and never turned back. Root cause: the approach corridor test
(`inApproachCorridor`) only checked position, not heading, so a jet astern but
facing the wrong way was classified `FINAL` — where the recovery assist
deliberately holds the *current* heading and leaves lineup to the player — and
under the autopilot nobody was flying lineup at all. `ApproachGuidance` now
also checks heading; a jet in position but facing the wrong way gets a short,
tight reversal (`homeTurnSpeed`, `homeTurnMaxBank`) back onto the final course
instead. See `GameLoop.smoke.test.ts`'s "take me home from anywhere" test.

## 87. The training card's altitude readout mixed units with the altimeter next to it **[Fixed in 1.11.0]**

The `CLIMB TO 2,500 FT` card's detail line read "Current altitude: X m" in
metres, directly beside a HUD altimeter reading feet. Cheap, real confusion;
now both read feet.
