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
frame. **Mitigation:** press `P` to cycle the display mode; `CLEAN` disables
the bloom pass entirely. `PostProcess.nextQuality()` implements an adaptive
ladder with hysteresis, but it is not yet wired to a live frame-time average —
quality follows the chosen display mode.

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
hard to read on every HiDPI screen. `RETRO CRT` display mode still provides
the scanline/vignette/persistence look without sacrificing glyph sharpness.

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

## 14. Adaptive quality ceiling is the player's choice

A rolling frame-time average (EMA) now drives `PostProcess.nextQuality()` every
0.5 s, but the result is clamped to the ceiling the chosen display mode allows.

**Consequence:** the game will back the bloom pass off on slow hardware, but it
will never raise quality above what `P` selected — so a player who picked `CLEAN`
on a fast machine stays on `CLEAN`. That is deliberate: an effect the player
turned off must stay off.

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
