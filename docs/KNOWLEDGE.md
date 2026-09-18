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

Translate by `−camPos`, then apply **−yaw, −pitch, −roll** in that order:

```
x₁ = dx·cos(−ψ) + dz·sin(−ψ)
z₁ = dz·cos(−ψ) − dx·sin(−ψ)
y₂ = dy·cos(−θ) − z₁·sin(−θ)
z₂ = z₁·cos(−θ) + dy·sin(−θ)
x₃ = x₁·cos(−φ) − y₂·sin(−φ)
y₃ = x₁·sin(−φ) + y₂·cos(−φ)
```

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

The flight path marker projects a probe point 5,000 m along `v̂` through the
actual camera pipeline, guaranteeing it sits on the true flight path.

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

### Phosphor persistence

```
α = clamp( 1 − e^(−Δt/τ), 0.02, 1 )        τ = 0.06 s
```

Frame-rate independent — a constant α gives 2.4× longer trails at 144 Hz than 60 Hz.

**Decay target is `rgb(3,10,4)` (`#030a04`), NOT the background `#051008`.** Decaying
toward a colour equal to the background does not converge under 8-bit rounding
(a channel at 6 → `round(0.757·6 + 0.243·5)` = 6 forever), leaving permanent ghosting.

### Bloom

¼-resolution downscale (bilinear filtering is the first blur), then a `multiply`
self-composite as a pseudo-threshold (squares every channel, `v → v²/255`, collapsing
the dark background while saturated phosphor survives), then a blur, then an additive
`lighter` composite at strength 0.5.

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

| Colour | Use |
| --- | --- |
| `#00ff66` | Primary phosphor |
| `#00aa44` | Dim / secondary text |
| `#33aa33` | Ridge lines (> 900 m) |
| `#1d8a2c` | Horizon ring, upper slopes |
| `#00632a` | Sea lattice, canyon floor |
| `#004400` | Low terrain |
| `#051008` | Background (hard clear) |
| `#030a04` | Persistence decay floor |
| `#ffaa00` | Warning / caution |
| `#ffff33` | Runway markings, catapult ready |
| `#ff3333` | Alert / hostile |
