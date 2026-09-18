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
frame. **Mitigation:** press `P` to cycle quality (HIGH → LOW → OFF).
`PostProcess.nextQuality()` implements an adaptive ladder with hysteresis, but
it is not yet wired to a live frame-time average — quality is currently manual.

## 7. Canvas2D `filter` support

The bloom blur uses `ctx.filter = 'blur(2px)'`, unsupported on some older Safari
versions. A 4-tap offset `drawImage` fallback is feature-detected at construction.
**Consequence:** slightly softer bloom on those browsers.

## 8. Device pixel ratio pinned at 1:1 **[By design]**

The canvas backing store matches CSS pixels exactly, with
`image-rendering: pixelated`. On HiDPI displays the result is deliberately
chunky. This is the retro aesthetic and keeps the bloom pass cheap.

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
block are displayed inside 3 km. It remains the hardest skill in the game — by
design, since a graded 3-wire trap is worth real score.

## 11. Terrain is analytic, not noise-based **[By design]**

`TacticalTerrain` uses a deterministic sine/cosine canyon profile with bilinear
interpolation rather than Perlin noise or midpoint displacement.
**Consequence:** the map is identical every run and has visible periodicity.
The upside is that it is fully deterministic, trivially testable, and the canyon
corridor is guaranteed navigable — important because terrain masking is a core
mechanic that a random heightfield could break.

## 12. Enemy contacts spawn within the canyon corridor

Package `bearingDeg` drives lateral offset and radar plotting, but contacts
always ingress from the `+Z` corridor rather than their true bearing.
**Consequence:** the threat rose bearing is thematic rather than literal. This
prevents contacts spawning buried inside mountain geometry.

## 13. Single aircraft on deck

The deck state machine tracks exactly one aircraft. Spare airframes are a
counter, not a fleet — you cannot have several jets at different readiness
states simultaneously. This limits the depth of the logistics loop.

## 14. Adaptive quality not auto-engaged

`PostProcess.nextQuality()` exists and is unit-tested, but no rolling frame-time
average currently drives it. Quality changes only via the `P` key.
