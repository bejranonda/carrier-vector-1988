# Known Issues & Deliberate Trade-offs

Honest accounting of current limitations. Items marked **[By design]** are
conscious decisions, not defects — please don't "fix" them without discussion.

---

## 1. Browser Web Audio autoplay policy

Browsers suspend `AudioContext` until a user gesture. Audio is unlocked on the
first `keydown` or `mousedown` (`src/main.ts`), and `SoundFX.init()` calls
`ctx.resume()` when suspended. **Consequence:** the game is silent until the
player presses a key. This is unavoidable under current browser policy.

## 2. Euler angles and gimbal lock

Orientation uses Euler angles rather than quaternions. Pitch is clamped to
±88° in `applyPitchInput()` to avoid the singularity at ±90°.

**Consequence:** true vertical flight (pure loops through the zenith) is not
possible, and yaw becomes ill-conditioned at extreme pitch. A quaternion
rewrite is the correct long-term fix but would ripple through the renderer,
HUD symbology and enemy AI.

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
[`docs/reviews/v1.5.0-dev/RECOMMENDATIONS_AND_ROADMAP.md`](reviews/v1.5.0-dev/RECOMMENDATIONS_AND_ROADMAP.md) T0-1.

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

Full analysis: [`docs/reviews/v1.5.0-dev/`](reviews/v1.5.0-dev/COMPREHENSIVE_GAME_REVIEW.md)

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

## 40. Pitch axis defaults against genre convention **[Partly resolved in v1.5.0]**

`Controls.ts:31-32` binds `ArrowUp` to **pitch up**. The flight-sim convention
(MSFS, X-Plane, DCS, IL-2, Ace Combat) is `ArrowUp` = stick forward = **nose
down**. A toggle exists on `[I]` with excellent labelling
(`STICK: REAL (UP = DIVE)` / `STICK: DIRECT (UP = CLIMB)`), but it defaults to
the non-standard mode and is one of 40+ flat keybindings.

**Fix:** ask once on the briefing screen in behavioural language
("PULL BACK TO CLIMB" vs "PUSH UP TO CLIMB" — never the word "inverted"), and
detect rapid pitch-axis reversals in the first 60 s to offer the fix in context.

## 41. No key remapping **[P2]**

`CONTROL_SCHEMA` is a `readonly` const consumed directly, with no override
layer. **Consequence:** `WASD`+`QE` occupy different physical positions on
AZERTY and QWERTZ keyboards, so the game is measurably harder outside
QWERTY regions, and left-handed or limited-mobility players have no recourse.

## 42. Incoming missiles are effectively invisible **[Partly resolved in v1.5.0]**

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

## 44. Chaff and the HARM have no touch controls

The touch layout has three weapon buttons and no room for a fourth or a chaff button without
re-solving `TouchLayout` and its hit-test priority order. A touch pilot can neither press `X` nor
select the HARM. Same shape as #31 (deck touch parity), recorded rather than rushed.

## 45. PRO HUD weapon-chip click regions are fixed-width

The ARCADE bar's geometry is now one solver shared by renderer and hit-tester. The PRO systems
panel is not: its chips are drawn at measured text width but hit-tested at a fixed 68 px, so a long
label can desynchronise them. Fix the same way (`solveArcadeBar`'s approach).

## 46. `P` and the CLEAN / RETRO looks are gone **[By design]**

One screen style, deliberately. A stored value from the old ladder is ignored and the game boots into
MODERN. RETRO's per-stroke shadow cost ~7 ms/frame at 1600x900 and its 0.7 vignette hurt legibility.

## 47. The HARM's kill radius and range are tuned by reasoning, not by playtest

`HARM_TUNING` (600 m/s, 15 s burn, 20 m hit radius) has unit tests but has not been flown by a human
against the SHATTERED_RIDGE belt. Expect a balance pass.

## 48. Not shipped from the v1.5.0 plan

Cruise-missile fire support (`Z`), progressive control disclosure by mission, struggle detection
(auto-offering the stick flip after repeated pitch reversals), key remapping, and the autopilot
coordinated-turn rework (#19). Cut deliberately when the scope was simplified.

---

# New findings from human playtest (v1.6.0-dev)

## 49. Decoupled Euler Roll and Yaw: Bank-to-turn does not exist **[P0 — Critical]**

In `src/flight/AircraftPhysics.ts:163-185`, roll input (`A`/`D` or `Left`/`Right`) only increments
`this.roll`. Bank angle does not couple into `this.yaw` at all, so rolling the wings creates zero
heading change. Yaw is only updated via `applyYawInput()`, which is bound exclusively to `Q` and `E`
(rudder). Because `forwardVector` is derived from `yaw` and `pitch`, thrust acts purely down the initial
heading vector.

**Consequence:** A player who flies using standard arrow keys or WASD rolls sideways but the jet
continues flying North forever. This directly breaks the universal flight-genre convention of
coordinated bank-to-turn.

## 50. Pitch clamped to ±88° prevents loops and Immelmann turns **[P0 — Critical]**

In `src/flight/AircraftPhysics.ts:155`, pitch is clamped:
```ts
const maxPitch = 88 * (Math.PI / 180);
if (this.pitch > maxPitch) this.pitch = maxPitch;
if (this.pitch < -maxPitch) this.pitch = -maxPitch;
```
To avoid Euler gimbal singularities, pitch cannot exceed 88°.

**Consequence:** When a player attempts to turn around by pulling back into an inside loop, Split-S,
or Immelmann, the jet hits an invisible ceiling at 88° (near-vertical), bleeds all airspeed, stalls,
and slides backward while still facing North.

## 51. RWR masquerading as a tactical radar **[P0 — Critical UX]**

The bottom-right scope (`src/renderer/HUD.ts:1454`) is an electronic warfare Radar Warning Receiver (RWR)
displaying cryptic military letters (`S` for search, `T` for track, `M` for missile, `X` for decoyed).
Players expect a **Tactical Radar / Minimap**.

**Consequence:** The scope does not display the aircraft carrier (home base), airborne enemy contacts
(MiGs, bombers), mission waypoints, or terrain boundaries. Players feel completely blind and disoriented.

## 52. Instant snap to 2D deck on airframe destruction **[P1]**

When `this.physics.damage >= 100` (`src/core/GameLoop.ts:1967`), `replaceAirframe()` immediately sets
`this.currentView = 'MACRO_DECK'`.

**Consequence:** The 3D cockpit view vanishes instantly without an in-flight explosion camera, slow-motion
failure cadence, or prominent HUD crash banner. The player is abruptly teleported to the carrier deck
maintenance screen with no emotional closure on why they died.

## 53. 1-Dimensional Fjord bowling alley **[P1]**

In `src/tactics/TerrainProfiles.ts:60-79`, the signature map `FJORD` restricts navigable flight to a
500-metre wide corridor ($|X| < 500$ m). Beyond 500 m, terrain rises precipitously to 1800 m vertical
walls.

**Consequence:** Combined with the inability to steer via roll (#49), the player is funnelled down a
narrow gutter directly into enemy missile envelopes.

## 54. Cognitive overload and absence of dynamic contextual HUD guidance **[P0]**

The HUD displays up to 22 instruments simultaneously, while zero contextual prompts exist in combat.
Beginners do not know which key to press when a bandit merges or when an attack run starts.

**Fix:** Default to a clean Arcade HUD and introduce a dynamic "Rookie Copilot" prompt at bottom-center
(`[T] LOCK BANDIT`, `[SPACE] FIRE`, `[X] DEPLOY CHAFF`, `[L] APPROACH CARRIER`).

## 55. Lack of beginner milestone progression and victory feedback **[P1]**

The game does not provide intermediate micro-rewards (e.g. drone splash confirmation fanfare, waypoint
milestone chimes, or a short novice qualification mission). Players experience repeated failure without
feeling any sense of mastery.

