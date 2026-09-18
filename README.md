# CARRIER VECTOR: 1988
**Autonomous Dual-Loop Carrier Deck Logistics & 3D Vector Tactical Sortie Simulation**

A retro 1980s CRT green phosphor dual-loop simulator combining **Macro Carrier Deck Logistics** (turnaround queues, crew stamina, ordnance allocation, and threat interception) with **Micro 3D Vector Flight Simulation** (6-DOF aerodynamics, canyon radar masking, and dogfighting).

---

## Key Technical Specifications

- **Runtime:** TypeScript with Vite on HTML5 Canvas.
- **Zero 3D Engine Dependencies:** No Three.js, Babylon.js, or Pixi.js. All 3D rotations, camera translation, near-plane line clipping, and perspective divide are implemented with **pure linear algebra**.
- **1980s Phosphor Vector Display Aesthetic:** Monochrome green vector styling, electron bloom glow, scanlines, chromatic mask, and vignette curvature.
- **Procedural Web Audio API Sound:** Pure synthesized retro SFX including jet turbine whine, afterburner white noise, multi-state RWR warning beeps, 20mm Vulcan cannon bursts, and catapult launch clunks.

---

## Architectural Decomposition

```
src/
├── audio/
│   └── SoundFX.ts          # Web Audio procedural synthesis (turbine whine, RWR, gunfire)
├── carrier/
│   ├── DeckManager.ts      # Deterministic queuing simulator & threat director
│   └── CarrierDeck.test.ts # Vitest tests for carrier queues & resource management
├── flight/
│   ├── AircraftPhysics.ts      # 6-DOF aerodynamics engine & dynamic AoA
│   ├── AircraftPhysics.test.ts # Headless flight physics validation
│   └── Weapons.ts              # Ballistics, missiles, bombs, & explosion bursts
├── tactics/
│   ├── RadarLOS.ts         # Heightmap, line-of-sight raycasting, & RCS formulas
│   └── RadarLOS.test.ts    # Headless radar masking & RCS calculation tests
├── renderer/
│   ├── VectorRenderer.ts   # Near-plane clipped 3D wireframe projection engine
│   └── HUD.ts              # Vector cockpit overlay (ladder, tapes, RWR, reticle)
├── core/
│   └── GameLoop.ts         # Bridge loop coordinating macro and micro layers
├── style.css               # CRT phosphor screen styling & scanline shaders
└── main.ts                 # Input dispatcher and runtime startup
```

---

## Simulation Physics & Mathematical Models

### 1. 3D Perspective Projection Pipeline
World coordinates $\mathbf{P}_w$ are transformed to camera space through yaw ($\psi$), pitch ($\theta$), and roll ($\phi$) rotation matrices:
$$\mathbf{P}_c = \mathbf{R}_z(-\phi) \mathbf{R}_x(-\theta) \mathbf{R}_y(-\psi) (\mathbf{P}_w - \mathbf{C}_{pos})$$

Near-plane line clipping interpolates vertices against $z_{near} = 2.0\text{ m}$:
$$t = \frac{z_{near} - z_1}{z_2 - z_1}, \quad \mathbf{P}_{clipped} = \mathbf{P}_1 + t(\mathbf{P}_2 - \mathbf{P}_1)$$

Perspective divide projects camera space points to 2D screen coordinates $(x', y')$:
$$x' = \frac{x \cdot f}{z} + x_0, \quad y' = -\frac{y \cdot f}{z} + y_0$$

### 2. Aerodynamics & 6-DOF Flight Dynamics
- **Dynamic Angle of Attack ($\alpha$):** Computed in real-time from the normalized velocity vector and aircraft forward/up axes.
- **Aerodynamic Stall:** Exceeding $\alpha_{crit} \approx 18^\circ$ induces post-stall flow separation, dropping lift and reducing control surface authority to $22\%$.
- **G-Load Induced Drag:** Pulling hard banked turns increases induced drag coefficient non-linearly:
  $$C_{Di} = \frac{C_L^2}{\pi e AR} \times \left[1 + (G - 1)^{1.8} \times 0.35\right]$$
  bleeding aircraft kinetic energy during dogfights.
- **Throttle & Afterburner Envelope:**
  - $0\% - 100\%$: Military Power with base fuel burn rate of $1.6\text{ L/s}$.
  - $101\% - 150\%$: Full Afterburner spiking fuel consumption by **3.5x** and multiplying thermal signature up to $4.0\text{x}$.
- **Weapons Bay Drag:** Opening the internal weapons bay doors increases parasitic drag $C_{D0}$ and multiplies radar signature.

### 3. Tactical Radar LOS & RCS Mathematics
- **Terrain Masking:** Ground SAM radar stations cast 3D raycasts along the line of sight to the player aircraft. If ray height drops below the procedural canyon heightmap, radar lock breaks (`STATUS: TERRAIN MASKED`).
- **Effective Radar Cross Section (RCS):**
  $$\text{RCS}_{\text{effective}} = \text{RCS}_{\text{base}} \times \text{Aspect Factor} \times (\text{Bay Open ? } 4.0 : 1.0)$$
- **Radar Warning Receiver (RWR):**
  - `SEARCH`: Pulsing $750\text{ Hz}$ tone (1.2s interval)
  - `TRACK`: Rapid $1200\text{ Hz}$ ping ($220\text{ ms}$ interval)
  - `MISSILE LAUNCH`: Alternating $1600\text{ Hz} / 1100\text{ Hz}$ warbling klaxon with active missile tracking!

---

## Controls Reference

### Flight Controls (Micro Sim View)
| Key | Function |
|---|---|
| `W` / `Down Arrow` | Pitch Down |
| `S` / `Up Arrow` | Pitch Up |
| `A` / `Left Arrow` | Roll Left |
| `D` / `Right Arrow` | Roll Right |
| `Q` / `E` | Rudder (Yaw Left / Right) |
| `Shift` / `Ctrl` | Throttle Advance (Afterburner) / Throttle Retard |
| `Space` | Fire Selected Weapon |
| `1` | Select 20mm M61A1 Vulcan Cannon |
| `2` | Select AIM-9L Sidewinder Heat-Seeking Missiles |
| `3` | Select Mk.82 500lb Iron Bombs |
| `B` | Toggle Weapons Bay Doors (Open: increases drag & x4.0 RCS) |
| `Tab` | Switch to Macro Carrier Deck Logistics View |

### Carrier Deck Controls (Macro View)
| Key | Function |
|---|---|
| `Tab` | Return to Cockpit 3D Flight View |
| `Enter` | Launch Aircraft from Catapult No. 1 (when `CATAPULT_READY`) |
| `1` / `2` | Decrease / Increase Planned Fuel Allocation ($\pm 500\text{ L}$) |
| `3` | Cycle Planned Sidewinder Loadout ($0 - 6\text{ missiles}$) |
| `4` | Cycle Planned Mk.82 Bomb Loadout ($0 - 4\text{ bombs}$) |

---

## Verification & Testing

Run the headless unit test suite verifying physics vectors, carrier state transitions, and radar calculations:
```bash
npm test
```

Run the development server locally:
```bash
npm run dev
```

Build the production distribution:
```bash
npm run build
```
