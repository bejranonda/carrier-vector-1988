# Knowledge Base — Mathematical & Domain Reference

Quick-reference sheet for every constant, formula and identifier in the simulation.

---

## 1. Domain Summary

CV-68 operating in the Norwegian Sea, 1988. The player alternates between macro
flight-deck logistics and micro 3D vector sorties. Soviet strike packages (MiG-23
Flogger escorts, Tu-22M Backfire bombers) approach on a timeline; unintercepted
packages damage the carrier. Ground SAM sites (SA-6 Gainful, SA-8 Gecko, SA-11
Gadfly) defend the canyon corridor.

## 2. Coordinate System

Right-handed, metres:

| Axis | Direction |
| --- | --- |
| `+X` | East |
| `+Y` | Up (MSL = 0) |
| `+Z` | North |

Heading `ψ = 0` faces `+Z`. Pitch `θ > 0` is nose-up. Roll `φ > 0` is right-wing-down.
Carrier deck surface sits at `y = 20 m`, centred on the world origin.

## 3. 3D Projection Pipeline

### Camera transform (world → camera)

Translate by `−camPos`, then project onto the camera's own orthonormal basis —
the **same** right / up / forward vectors `AircraftPhysics` uses for lift, thrust
and drag:

```
d      = p − camPos

forward = ( cosθ·sinψ,                  sinθ,        cosθ·cosψ )
up      = ( −sinφ·cosψ − sinθ·sinψ·cosφ, cosθ·cosφ,  sinφ·sinψ − sinθ·cosψ·cosφ )
right   = ( cosφ·cosψ − sinθ·sinψ·sinφ, −cosθ·sinφ, −cosφ·sinψ − sinθ·cosψ·sinφ )

x_cam = d · right      y_cam = d · up      z_cam = d · forward
```

**Why not three composed rotation matrices?** Because that is what it used to be,
and the composition had the sign of pitch and roll backwards — it rotated by
`−θ` and `−φ` where world→camera needs `+θ` and `+φ` (only the yaw term was
right). The consequences were severe and long-lived:

- pulling the nose **up** moved the terrain and horizon **up** the screen;
- rolling right rolled the world right instead of left;
- the pitch ladder — which is derived correctly from `fov·tan(Δ)` — drew its
  horizon rung exactly as far *below* screen centre as the real 3D horizon was
  *above* it, i.e. `2·fov·tan(θ)` apart;
- the flight path marker sat on the wrong side of the horizon in level flight.

Deriving the transform from the physics basis makes the view agree with the
flight model by construction. `VectorRenderer.test.ts` asserts the equality
directly, so the class of error cannot return. The basis is memoised per frame
(the angles are constant across a frame's thousands of `drawLine` calls).

### Near-plane clipping

`z_near = 2.0 m`. Segments entirely behind are rejected; straddling segments are
interpolated at `t = (z_near − z₁)/(z₂ − z₁)`.

### Perspective divide

```
x' =  x·f/z + x₀        f (focal length / fov) = 380
y' = −y·f/z + y₀        (Y inverted for canvas space)
```

### Mesh world transform

Object-space points are placed using basis vectors derived from the mesh's own
pitch/yaw/roll, matching `AircraftPhysics`' convention:

```
forward = ( cosθ·sinψ,  sinθ,  cosθ·cosψ )
up      = (−sinφ·cosψ − sinθ·sinψ·cosφ,  cosθ·cosφ,  sinφ·sinψ − sinθ·cosψ·cosφ )
right   = ( cosφ·cosψ − sinθ·sinψ·sinφ, −cosθ·sinφ, −cosφ·sinψ − sinθ·cosψ·sinφ )

world = worldPos + local.x·right + local.y·up + local.z·forward
```

With `θ = φ = 0` this reduces exactly to the original yaw-only two-term rotation.

### Distance haze

```
fade = 1 − (z − 600)/(8000 − 600) · (1 − 0.12),  clamped to [0.12, 1.0]
lineWidth' = lineWidth · (0.6 + 0.4·fade)
```

`FAR_FADE = 8000 m` matches `TacticalTerrain`'s draw-cull distance so lines fade
out rather than popping.

## 4. Flight Aerodynamics

### Constants

| Symbol | Value | Meaning |
| --- | --- | --- |
| `g` | 9.80665 m/s² | Gravity |
| `α_crit` | 18° | Critical angle of attack |
| `T_mil` | 95,000 N | Military thrust |
| `T_ab` | 145,000 N | Full afterburner thrust |
| `S` | 38.0 m² | Wing area |
| `ρ₀` | 1.225 kg/m³ | Sea-level air density |
| — | 1.6 L/s | Base fuel burn at 100% military |
| — | 3.5× | Afterburner burn multiplier |
| — | 11,000 kg | Empty mass |

### Atmosphere and dynamic pressure

```
ρ = ρ₀ · e^(−y/8500)
q = ½ · ρ · v²
```

### Angle of attack

```
α = −asin( v̂ · û_up )          (or the nose angle if flying backwards)
```

### Lift and drag

```
C_L = clamp(α° × 0.085, −1.0, 1.6)        non-stalled
C_L = sign(α) × 0.25                       post-stall

C_Di = C_L² / (π · e · AR)                 e = 0.78, AR = 3.5
C_Di × = 1 + (G − 1)^1.8 × 0.35            when G > 1.5
C_D  = C_D0 + C_Di + (stalled ? 0.25 : 0)  C_D0 = 0.024, +0.035 if bay open

Lift = q · S · C_L                          along û_up
Drag = q · S · C_D                          opposite v̂
G    = |Lift| / (m · g)
```

### Stall & control authority

```
stalled       = |α| > α_crit
authority     = (stalled ? 0.22 : 1.0) × (1 − damage/100 × 0.6)
control rate ∝ authority × clamp(v/150)
```

### Battle damage

```
damage        ∈ [0, 100];  100 = airframe destroyed
fuelLeakRate  = damage/100 × 8.0 L/s
```

### Mass

```
m = 11,000 + fuel×0.8 + rounds×0.25 + sidewinders×86 + bombs×227   [kg]
```

## 5. Sensor Math

### Radar cross-section

```
RCS_eff = RCS_base × AspectFactor × (BayOpen ? 4.0 : 1.0)      RCS_base = 2.4 m²

AspectFactor = max(0.5, headTailFactor + |sin β| × 1.5)
```

Detection range scales with the fourth root (radar range equation):

```
range = range_base × (RCS_eff / RCS_base)^0.25
```

Base ranges: search 12,000 m · track 7,500 m · launch 5,000 m.

### Line of sight

Ray-marched from radar to aircraft in 40 m steps; occluded if the ray dips below
the interpolated terrain elevation at any sample. Occlusion sets
`STATUS: TERRAIN MASKED`, forces RWR to `SILENT`, and **kills any missile in flight**.

### Missile proximity fuze (swept sphere)

Closest point on the travel segment `A → B` to aircraft `P`:

```
t* = clamp( ((P − A) · (B − A)) / |B − A|² , 0, 1 )
missDistance = | A + t*(B − A) − P |

hit    if missDistance ≤ 40 m
damage = 55 × (1 − missDistance/40)
```

**Why segment-based:** at 480 m/s with `dt` clamped to 0.1 s the missile advances
48 m per tick — greater than the fuze radius — so an end-of-tick distance check
would tunnel straight through the target.

## 6. HUD Symbology

World-referenced symbols derive their scale from the renderer's focal length:

```
screenOffset = fov · tan(Δangle)
```

Nose-up is positive pitch, so the horizon rung lands **below** screen centre — and
because the camera transform is now derived from the same orientation basis, it
lands exactly on the real 3D horizon. The flight path marker projects a probe
point 5,000 m along `v̂` through the actual camera pipeline, so it sits on the
true flight path (and therefore on the horizon rung in level flight).

### Instrument placement

`solveHudLayout()` (pure, in `renderer/HudLayout.ts`) places the cockpit blocks
left-to-right from the actual viewport rather than at fixed offsets from screen
centre, and gives the pitch ladder whatever half-width is left in the middle:

```
railRight = edge + (checklist shown ? 196 : 0)
speedX    = cx − symHalf − gap − speedW        (clamped right of the rail)
symHalf   = clamp( cx − speedX − speedW − gap, 86, 205 )
altX      = min( width − edge − altW, cx + symHalf + gap )
ladder geometry scales by symHalf / 205
```

The checklist is dropped below 1150 px wide and the systems panel becomes a
one-line bottom strip below 560 px tall, since neither fits alongside the centre
instruments. Tests assert no two centre-line instruments overlap and none leaves
the viewport, across a 10 × 7 × 2 matrix of sizes.

### Guidance

| Channel | Question it answers | Module |
| --- | --- | --- |
| Objective strip / orders panel | What is this phase asking of me, and which key does it? | `core/Objectives.ts` |
| Coach ticker | What is about to kill me? | `core/Tutorial.ts` |
| Flight checkout | Which controls have I proved I can use? | `TrainingSequence.checklist()` |
| Designation bracket | Which thing have I chosen, how far is it, what kills it? | `tactics/TargetDesignation.ts` |
| Assist annunciator | Which protection is flying the aeroplane right now? | `assistCaption()` in `renderer/HUD.ts` |

The designated target draws a solid box in the key colour (amber when the
current geometry actually supports a shot) with `NAME · RANGE · WEAPON`
underneath; off the glass it becomes a chevron on the boresight ring plus a
`TURN LEFT / RIGHT` line. That is deliberately a different shape from both the
air-contact corner brackets and the strike-target diamond, so three kinds of
"something is there" never read as one.

The assist annunciator is silent for `LEVEL` and `NONE`, and fires only once a
protection takes more than 0.02 of stick authority. Auto-levelling happens on
every frame the stick is centred; a caption for it would be permanently lit, and
a permanently lit annunciator is one the pilot has learned to ignore by the time
it says `TERRAIN — AUTO PULL-UP`.

The objective strip reserves 150 px on each side of itself so it cannot run
underneath the score chip in the same band — the two collided below ~1000 px.

Contextual coach rules outrank the training prompt. The reverse ordering — which
shipped — suppressed stall, terrain and missile warnings for a first-time
pilot's entire first sortie. The HUD also suppresses the ticker when the warning
banner already covers the same cause, so one condition never produces three
simultaneous messages.

### Carrier approach

```
glideslope   = 3.5°
desiredAlt   = 20 + tan(3.5°) · rangeToShip
ballIndex    = clamp( round( (alt − desiredAlt) / 6 ), −2, +2 )
AoA on-speed = 8.1° ± 1.2°
```

### Trap envelope and grading

| Condition | Value |
| --- | --- |
| Range to boat | < 190 m |
| Altitude | 17–30 m |
| Airspeed | < 95 m/s |

Wires modelled at `z = −120, −110, −100, −90`; touchdown outside `[−125, −85]` is a bolter.

## 7. Carrier Logistics

### State machine

```
HANGAR_MAINTENANCE  (18 s, MECHANIC)
  → ARMING_REFUELING (14 s, min of FUEL/ORDNANCE crew speed)
  → CATAPULT_READY
  → CATAPULT_LAUNCHING (2.5 s stroke)
  → AIRBORNE
  → RECOVERY_TRAP (3.0 s de-rig)
  → HANGAR_MAINTENANCE | DAMAGED_REPAIR (30 s)
```

Crew stamina scales task speed by up to 60%. `DeckManager.catapultTimer` is the
single authoritative launch clock.

### Consequence accounting

| Event | Effect |
| --- | --- |
| Tu-22M reaches the carrier | −35% hull, −1 airframe |
| MiG-23 reaches the carrier | −15% hull |
| Dry-tank trap | −1 airframe, −10% hull, → `DAMAGED_REPAIR` |
| Terrain impact / destroyed | −1 airframe |
| Hull reaches 0% | `missionState = 'FAILED'` |

### Procedural waves

Deterministic `mulberry32` PRNG. Per wave `n`:

```
packages     = min(4, 1 + ⌊n/3⌋)
baseEta      = max(80, 200 − 8n)   seconds
bomberChance = min(0.5, 0.15 + 0.03n)
migCount     = 1 + ⌊rng × min(3, 1 + ⌊n/2⌋)⌋
```

## 7b. Scenarios

Five selectable missions, each a `ScenarioDef` in `core/Scenarios.ts`.

| Mission | Setup | Ends when |
| --- | --- | --- |
| `CARRIER_DEFENSE` | Endless escalating waves; the flight checkout runs | Hull reaches 0% (no scripted phases — score chase) |
| `CANYON_STRIKE` | Quiet sky, 2x Mk.82, hardened pen at `z = 10 400`, 240s window | Pen destroyed **and** trapped aboard; fails on the window, the hull, or running the boat out of jets |
| `IRON_HAND` | Flown on `KVITOYA_RIDGES`; 12 bombs in stock, one late CAP package | All four launchers dead **and** trapped aboard |
| `LAST_STAND` | Flown on `OPEN_SEA`; five packages at once, hull at 70%, 2 spares, wave 6 escalation | Every package resolved **and** trapped aboard |
| `CARRIER_QUALS` | Flown on `OPEN_SEA`; starts airborne, no SAMs, no contacts, clean jet | 3 traps including at least one 3-wire |

### The director

```
each tick:
  while phases[i].isComplete(snapshot): i++          (monotonic; several may pass at once)
  if i >= phases.length          -> SUCCESS
  else if failure(snapshot)      -> FAILED
```

Victory is tested **before** failure: both can become true on the same tick
(landing the last sortie on the last airframe), and a completed mission cannot
retroactively fail.

A phase without `onDeck` returns no objective while the jet is on deck, so the
deck's own director speaks there; the mission clock is carried across either
way via `MissionDirector.clock()`.

### Per-mission records

`core/MissionRecords.ts` keeps `{best, completions, attempts}` per scenario id.
A finished run is folded in by a pure merge; a **losing** run still counts as an
attempt and can still set a best, because surviving nine waves before dying is
a real result. `recommendScenario(records)` returns the suggested next mission:
the flight-checkout scenario when nothing has ever been flown, otherwise the
easiest uncleared one (preferring one already attempted), and once everything is
cleared, the hardest.

### The daily sortie

`core/DailySortie.ts`. The seed is the UTC date as an integer
(`YYYY*10000 + MM*100 + DD`), fed to the existing `mulberry32` wave director,
so two players on the same day get an identical campaign and consecutive days
do not resemble each other. The sortie number counts days from 2026-01-01.
Attempts are unlimited; the stored record keeps the best run whole (not a mix
of best figures from different attempts) and counts attempts, which the card
prints.

### Hardened targets

```
hit  <=>  hypot(impact.x - target.x, impact.z - target.z) <= hitRadius
```

The pen's radius is **55 m** against a SAM site's 180 m blast radius. That gap
is the entire difficulty of the strike mission: a lob from altitude cannot do
it, so the delivery has to be low, fast and aimed.

### CCIP

`WeaponsSystem.predictBombImpact()` runs the same semi-implicit integration the
live bomb uses, from the same release state (`y - 1.5`, `vel.y - 5`), stepping
at 1/30 s until it crosses the terrain. Tested against a real dropped bomb:
agreement within 25 m, comfortably inside the 55 m hit radius.

## 7c. Maps

`tactics/TerrainProfiles.ts`. A map is `{heightAt(x,z), sams, corridorHalfWidth,
corridorLength}`. `TacticalTerrain` samples `heightAt` into its 40x50 grid at
250 m per cell, and `SensorTacticsManager` builds its launchers from `sams`.

| Map | Height function | Sites |
| --- | --- | --- |
| `FJORD` | Flat slot inside \|x\| < 500 (h ≈ 15 ± 10), walls rising as `((\|x\|−500)/2000)^1.3 × 900`, capped at 1800; passes where `sin(0.0012 z) > 0.7` cut height to 35% | 3 |
| `OPEN_SEA` | Four cosine domes (`h = peak/2 × (1 + cos(πd/r))`) plus a ±3 m swell | 2, ship-borne, on open water |
| `SHATTERED_RIDGE` | Ridges every 1800 m of z, crest 620 ± 200, gap centre walking as `1000 sin(1.7 n)`, notch `0.12 + 0.88 (d/800)²`, faded in by `clamp((z−2200)/1200)` | 4 |

Invariants enforced by `TerrainProfiles.test.ts` for every map: heights finite
and non-negative; a clear approach tube along the deck centreline; a continuous
corridor under 220 m at least 300 m wide from the boat to the far end; SAM sites
above the waterline; and somewhere on the corridor a place where terrain masks a
site. `OPEN_SEA` is exempt from the last one by design, which is why the
flight-checkout scenario is not flown there — its "descend until the RWR goes
silent" step would be unsatisfiable.

## 7d. Flight assist

`flight/FlightAssist.ts`. Pure control laws; `GameLoop.applyFlightInput()` turns
the keyboard into a `PilotInput`, resolves it, and feeds the result to the same
`applyPitchInput` / `applyRollInput` / `applyYawInput` the player was using.

```
stall limiter   gate = 0.6 × αlimit (αlimit = 0.26 rad)
                α ≤ gate            -> pass through
                α > gate            -> demand × (αlimit − α)/(αlimit − gate)
                stalled             -> min(demand, −0.6)   (push, always)

terrain floor   onApproach          -> pass through
                agl ≤ 70            -> max(demand, 1)
                t_impact = (agl − 70)/sink
                byTime   = clamp((8 − t_impact)/4)
                byHeight = clamp(1 − (agl − 70)/110) × 0.6
                urgency  = max(byTime, byHeight)
                demand × (1 − urgency) + urgency

autopilot       bank    = clamp(Δψ × 1.5, ±maxBank);  roll = clamp((bank − φ) × 2.2)
                rudder  = clamp(Δψ × 1.1)
                pitch   = clamp(Δh × 0.0016 × max(0.25, cos φ), −0.8..0.9) − 0.8 θ
                throttle= clamp(ΔV × 0.05)
```

Two facts the laws are built around:

- **Time, not height, is what saves a dive.** A floor engaging at 180 m AGL has
  one second to work with at 60 m/s and a 1.35 rad/s pitch rate, which is not
  enough. Hence `t_impact`.
- **This flight model has no bank-to-turn yaw coupling.** `AircraftPhysics`
  changes `yaw` only through `applyYawInput`; banking tilts the lift vector and
  curves the flight path while the nose keeps pointing where it pointed. A
  bank-only autopilot therefore never captures a bearing, so the autopilot flies
  bank *and* rudder.

Order of authority: terrain floor > stall limiter > autopilot or pilot. A stall
at 2000 m is survivable; a controlled descent into a ridge is not.

## 7e. Target designation

`tactics/TargetDesignation.ts`. For each candidate:

```
range     = |target − shooter|
bearing   = atan2(Δx, Δz) mod 2π            (same convention as yaw)
aspect    = (Δ · forward)/(|Δ||forward|)    (1 = dead ahead)
priority  = range / max(0.08, (aspect + 1)/2)
```

Envelopes: the Sidewinder wants an **air** target with `aspect ≥ 0.64`
(≈50° seeker FOV) at 300–8000 m; the gun wants `aspect ≥ 0.985` inside 1800 m
and never applies to a hardened structure. Ranking sorts on `priority`, ties
broken by id so the cycle order is stable frame to frame.

`pursuitNav()` turns a solution into an autopilot `NavTarget`: co-altitude for an
air intercept (floored at 260 m AGL, bank limit 1.15), 520 m AGL at 250 m/s with
a 0.8 bank limit for a ground attack run.

## 7f. Operational tempo

`core/Pacing.ts`. The deck-crew durations were literals inside
`DeckManager.update()`; they are now injected through `ThreatProfile.timing`
and default to the original numbers.

| | ARCADE (default) | SIM |
| --- | --- | --- |
| Hangar maintenance | 4 s | 18 s |
| Arming / refuelling | 5 s | 14 s |
| Battle-damage repair | 8 s | 30 s |
| Trap de-rig | 1.5 s | 3 s |
| Spare airframe after a loss | 3 s, straight to arming | full hangar cycle |
| Opening timeline ETAs | ×0.35 (150/280/440 → 53/98/154) | ×1 |
| Contact spawn distance | ×0.55 (8.3 km → 4.6 km) | ×1 |

Measured in Chromium, briefing to first kill: **ARCADE 9.6 s; SIM produced no
kill inside a two-minute budget.** Crew stamina still scales every task, so
these are nominal durations, not stopwatch guarantees.

## 7g. Camera shake

`renderer/CameraShake.ts`. Trauma model, applied to the camera angles in
`GameLoop.drawCockpitSim()` and to nothing else.

```
trauma' = clamp01(trauma - 1.35 dt)
shake   = trauma²
pitch   = sin(2π · 17.3 t) · 0.035 · shake
yaw     = sin(2π · 13.1 t + 1.7) · 0.030 · shake
roll    = sin(2π ·  9.7 t + 3.1) · 0.055 · shake

blast(d) = clamp01((1 - d/700)²· 0.6)
```

Squared amplitude is what separates a cannon round (0.05 trauma) from a hit
taken (0.55): linear amplitude made every event feel the same size. The three
rates are incommensurate so a sustained shake never looks like a loop.

## 7h. Audio mix

`audio/AudioMix.ts` holds the decisions; `audio/SoundFX.ts` holds the
synthesis. Every voice runs:

```
voice -> [StereoPanner] -> category gain -> master (0.85) -> compressor -> out
```

The compressor is `threshold -18 dB, knee 12, ratio 6, attack 4 ms,
release 180 ms`. Bus levels: beds (engine 0.055, airflow 0.05, threat 0.10)
sit below events (weapons 0.30, world 0.50, impacts 0.55), and alerts (0.62)
sit above everything, because an alert is an instruction.

Spatialisation, for world events only:

```
gain = 1 / (1 + (d/320)²)          , zero beyond 7 km
pan  = ((Δ · right) / |Δ_horizontal|) × 0.85
```

Beds driven from simulation state:

```
airflow(v)      = { gain: 0.05 · t, cutoff: 300 + 2400 t },  t = clamp((v-60)/280)
buffet(α)       = clamp((|α| - 0.7 α_limit) / (0.3 α_limit)) , 1 when stalled
threatBed(rwr)  = SEARCH 0.045/54 Hz · TRACK 0.08/68 Hz · LAUNCH 0.10/92 Hz
```

Measured in Chromium with the simulation paused and the beds set by hand
(peak amplitude at the output): engine 0.15, cannon 0.15, kill confirm 0.28,
RWR launch 0.38, wire catch 0.39.

## 7i. Touch mode

`core/Platform.ts` decides the scheme:

```
touchCapable  = navigator.maxTouchPoints > 0
fingerPrimary = (pointer: coarse) AND NOT (hover: hover)
TOUCH         = touchCapable AND fingerPrimary AND max(w, h) <= 1180
```

The hover test is what separates a phone from a touchscreen laptop, and the
long-edge bound is what separates a phone or tablet from a kiosk. A stored
preference (`AUTO` / `TOUCH` / `KEYBOARD`) overrides all of it.

`renderer/TouchLayout.ts` places the controls. One scale drives everything:

```
scale = clamp(min(safeW / 780, safeH / 390), 0.72, 1)
```

so a 640 px phone shrinks the set rather than rearranging it. Controls are
anchored to the bottom corners inside the safe area, at least 44 px across,
and none may enter the centre keepout (150 px x scale each side), which
belongs to the pitch ladder, the flight path marker and the designation
bracket.

Stick deflection is relative to first contact, which is what makes a virtual
stick usable:

```
pitch = clamp(-(y - originY) / r)      roll = clamp((x - originX) / r)
throttle = clamp(1 - (y - trackY) / trackH) x 1.5
```

Each pointer is bound to the control it touched down on for the life of the
gesture: re-binding mid-gesture is how a stick silently becomes a throttle in
the middle of a turn.

### What touch mode sheds, and why

`solveHudLayout` and `computeDeckLayout` both take a reserve. The side blocks
do **not** reserve the thumb columns horizontally - the controls occupy the
bottom of those columns, so lifting the instrument centre clear of the band is
what is needed, and reserving the full column width drove the pitch ladder to
its 24 px hard floor on a 568 px phone.

| Shed | Threshold | Why it is safe |
| --- | --- | --- |
| Keyboard cheat strips, keycaps | always in touch | Advice a player cannot take |
| Flight checklist | always in touch | Needs a keyboard to tick against |
| Compass tape | height < 420 | Bearing is on the objective line and the designation bracket |
| RWR scope | height < 460 | The launch banner, the spatialised launch audio and the threat drone all still fire |
| Briefing phase cards, loss line | touch or height < 430 | The mission list and the button are what you press |
| Deck panels beyond orders and turnaround | always in touch | Crew stamina and the deck plan do not fit beside a button big enough to press |

## 7j. HUD label declutter

`renderer/LabelDeclutter.ts`. Contact range tags are placed before any is
drawn, greedily, nearest first:

```
for each candidate, in ascending range:
    try RIGHT, LEFT, ABOVE, BELOW of the bracket
    reject a seat that leaves the viewport, collides with an
      already-placed tag (+4 px), or covers an instrument
    place in the first seat that survives, else drop the tag
```

The brackets are always drawn — a contact never disappears — but a tag has to
earn its place. Three MiG-23s in a loose trail used to print three tags inside
forty pixels of each other and across the altitude block, which is strictly
worse than none: no tag is readable and the instrument behind them is gone.

The instrument rectangles come from the same `HudLayout` the instruments are
drawn from, so the keepouts cannot drift from what is on screen. Left and right
alone were not enough: in a head-on merge on a phone the contacts cluster
around the boresight with both sides blocked by the systems line, and every tag
was dropped.

## 8. Scoring

| Event | Points |
| --- | --- |
| Fighter | +100 |
| Bomber | +250 |
| SAM site | +150 |
| Trap | +75 (+150 more for a 3-wire) |
| Bolter | −25 |
| Airframe lost | −200 |
| Hull damage | −10 per % |
| Wave survived | +200 |

Ranks: NUGGET (<0) · ENSIGN (0) · LT (JG) (500) · LIEUTENANT (1,200) ·
LT COMMANDER (2,200) · COMMANDER (3,500) · CAPTAIN (5,500) · ADMIRAL (8,000).

## 9. Rendering & Post-Processing

### Display modes

Every screen effect is a field of one `DisplayModeSpec`, cycled with `P` and
persisted to `localStorage`:

| Mode | bloom | vectorGlow | τ (persistence) | scanlines | vignette |
| --- | --- | --- | --- | --- | --- |
| `CLEAN` | 0 | 0 | 0 (hard clear) | 0 | 0 |
| `MODERN` (default) | 0.42 | 0 | 0.035 s | 0 | 0.28 |
| `RETRO CRT` | 0.55 | 4 px | 0.075 s | 0.5 | 0.7 |

`vectorGlow` is the per-stroke Canvas2D shadow radius and is the single most
expensive thing the renderer does — a shadow is applied per `stroke()` and the
terrain mesh alone issues thousands per frame. Measured at 1600×900 on a software
rasteriser: **23.7 ms/frame with it, 16.7 ms without**. The bloom pass already
produces a vector glow at ¼ resolution over the whole layer, so only `RETRO` pays
for both.

### Phosphor persistence

```
α = clamp( 1 − e^(−Δt/τ), 0.02, 1 )
```

Frame-rate independent — a constant α gives 2.4× longer trails at 144 Hz than 60 Hz.
`τ = 0` means a hard clear (no trails), which is what `CLEAN` selects.

**The decay target must be strictly darker than the background.** Decaying toward a
colour equal to the background does not converge under 8-bit rounding (a channel at
6 → `round(0.757·6 + 0.243·5)` = 6 forever), leaving permanent ghosting.

**Shadow state must be cleared before the decay fill.** Canvas shadow state is
sticky: `drawLine()` armed `shadowColor`/`shadowBlur` for its glow and never reset
them, so `decayClear()`'s translucent full-screen rectangle painted a full-screen
*shadow* in whatever colour the last vector happened to be — usually SAM red. It
accumulated frame over frame to a measured median background of `rgb(107,24,21)`
against an intended `rgb(3,10,4)`, which is what made the flight screen unreadable.

### Bloom

¼-resolution downscale (bilinear filtering is the first blur), then a `multiply`
self-composite as a pseudo-threshold (squares every channel, `v → v²/255`, collapsing
the dark background while saturated phosphor survives), then a blur, then an additive
`lighter` composite at the mode's bloom strength.

### Resolution

Both the visible canvas and the offscreen world layer are sized to
`CSS px × devicePixelRatio` with their 2D contexts pre-scaled, so all layout code
works in CSS pixels while text and vectors render at native resolution. The ratio
is capped at **2×** so a 3×/4× display does not quadruple the bloom cost.

### Adaptive quality

A rolling frame-time average (EMA, α = 0.05) drives `PostProcess.nextQuality()`
every 0.5 s, and the result is clamped to the ceiling the chosen display mode
allows — so the game can back the bloom pass off on weak hardware but never
exceed what the player asked for.

### Fixed timestep

```
FIXED_DT = 1/120 s,  maxSubsteps = 8
```

Excess accumulated time beyond `maxSubsteps × FIXED_DT` is **discarded**, not queued —
a spiral-of-death guard.

## 10. Web Audio Synthesis

| Sound | Synthesis |
| --- | --- |
| Engine | Sawtooth 70→210 Hz through a lowpass (250→850 Hz cutoff) |
| Afterburner | Looping white-noise buffer through a bandpass @400 Hz, Q = 1.0 |
| RWR SEARCH | 750 Hz square, 90 ms pulse every 1200 ms |
| RWR TRACK | 1200 Hz square, 60 ms ping every 220 ms |
| RWR LAUNCH | Continuous warble alternating 1600/1100 Hz every 160 ms |
| Vulcan | Sawtooth 120→30 Hz over 40 ms |
| Missile | Sine 250→1200 Hz over 400 ms |
| Explosion | Triangle 90→20 Hz over 800 ms |
| Catapult | Sawtooth 60→140 Hz over 500 ms |

## 11. Colour Palette

All colour lives in `src/renderer/Theme.ts`. UI chrome and the 3D world are
deliberately separate sets.

### UI (`THEME`)

| Token | Value | Use |
| --- | --- | --- |
| `ground` | `#070d11` | Page and canvas ground |
| `ink` | `#eafff5` | Headline values read at a glance |
| `phosphor` | `#57e39b` | Primary instrument colour |
| `muted` | `#93a9a4` | Labels and secondary copy — neutral, **not** green |
| `key` | `#5fd8ff` | The player's agency: key names, the selected mission, the armed weapon, the designated target |
| `caution` | `#ffc94d` | Caution / ready |
| `alert` | `#ff6363` | Lethal / hostile |

### World (`WORLD`)

| Token | Value | Use |
| --- | --- | --- |
| `carrier` | `#7df0b4` | CV-68 wireframe |
| `terrain` | `#3fb97a` | Ridge lines (the thing you must fly below) |
| `valley` | `#0f4a2c` | Low terrain |
| `horizon` | `#2f9e63` | Horizon ring |
| `sea` | `#14603a` | Sea lattice |
| `hostile` | `#ff5b4a` | Enemy aircraft, SAM launchers |
| `missile` | `#ff2d2d` | SAM missile trails |

**Every UI token clears 4.5:1 contrast against `ground`**, verified in
`Theme.test.ts` and measured at the darkest point of the vignette. The previous
palette paired a saturated `#00ff66` with a desaturated `#00aa44` under a
92%-black vignette and a scanline mask, which put the most important readouts
below 3:1. The rule that replaced it: labels are neutral, values carry colour,
and cyan means "this one is yours" — a key you can press or a thing you have
chosen. Nothing the world does is cyan, which is what lets a designation bracket
read as a decision rather than as another contact.
