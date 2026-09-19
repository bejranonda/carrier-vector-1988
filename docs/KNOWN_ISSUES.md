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

Four things are persisted, all to `localStorage` under `carrier-vector-1988.*`:
the display mode, the global personal best, the flight assist level and the
per-mission records. Storage throws in Safari private mode and when
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

## 18. Mouse input is menu-only **[By design]**

Clicking advances the briefing and the debrief and closes the help overlay.
Flying, the deck and the payload are keyboard-only. **Consequence:** the game is
not playable on a touch device. A pointer-driven flight model is a different
game, not a port.
