# Recommendations & Engineering Roadmap (v1.6.0-dev)

> **Guiding Principle:** Every recommendation is strictly sorted by **Player Impact ÷ Lines of Code**.
> We prioritize fixing high-churn blockers that ruin the core flight experience before building complex new subsystems.

---

## 1. Executive Priority Matrix

| Tier | Focus Area | Player Impact | Estimated Lines | Impact / LOC | Target Milestone |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Tier 0** | **Flight Steering & 3D Loops** | **MAXIMUM (P0)** | ~45 lines | **9.8** | `v1.6.0` (Immediate) |
| **Tier 1** | **Tactical Radar & HUD Hints** | **VERY HIGH (P0)**| ~120 lines | **8.5** | `v1.6.0` |
| **Tier 2** | **Death Legibility & Victory Loop**| **HIGH (P1)** | ~90 lines | **7.2** | `v1.6.1` |
| **Tier 3** | **Exciting Branching Terrain** | **MEDIUM (P2)** | ~140 lines | **5.5** | `v1.7.0` |

---

## 2. Tier 0: Emergency Flight Fixes (Player Impact: 10/10, Effort: Small)

### 2.1. P0-A: Implement Coordinated Bank-to-Turn Aerodynamics
* **The Problem:** Rolling left (`A` / `Left Arrow`) tilts the aircraft model, but produces **0 deg/s of yaw or heading change**. The jet continues flying North forever unless the player presses `Q` or `E` (rudder).
* **The Mathematical Fix:** When banked at angle $\phi$, the horizontal component of lift generates a centrifugal turn rate:
  $$\dot{\psi} = \frac{g \tan(\phi)}{V} \cdot \cos(\theta)$$
  In `AircraftPhysics.ts:update()`, couple bank angle $\phi$ (`this.roll`) and dynamic pressure directly into heading rate $\dot{\psi}$ (`this.yaw`).
* **Implementation Blueprint (`src/flight/AircraftPhysics.ts`):**
```ts
// Inside AircraftPhysics.update(dt):
if (this.airSpeed > 20) {
    // Coordinated aerodynamic turn rate from bank angle (radians/sec)
    // Clamped to avoid division by zero or extreme singularities
    const turnRate = (AircraftPhysics.GRAVITY * Math.tan(this.roll) / Math.max(30, this.airSpeed)) * this.controlAuthority;
    this.yaw += turnRate * dt;
    
    // Normalize yaw to [0, 2*PI]
    if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;
    if (this.yaw < 0) this.yaw += Math.PI * 2;
}
```
* **Player Result:** Pressing Left/Right turns the jet immediately across the landscape, just like every flight game in history!

### 2.2. P0-B: Enable Full 360-Degree Vertical Loops (Immelmann & Split-S)
* **The Problem:** `this.pitch` is hard-clamped to $\pm 88^\circ$ (`AircraftPhysics.ts:155`), freezing the jet upright in mid-air and preventing players from climbing backward over the top to turn around.
* **The Fix:** Allow pitch to loop freely or execute a standard acrobatic pitch inversion (when crossing $\pm 90^\circ$, invert pitch and flip yaw/roll by $180^\circ$, or maintain quaternion / directional cosine representation). For arcade 6-DOF, allow pitch to traverse through $\pm \pi$ cleanly.
* **Player Result:** Pulling back on the stick allows the player to perform an inside loop or climb backward to escape threats.

---

## 3. Tier 1: Tactical Radar & On-Screen Guidance (Player Impact: 9/10, Effort: Medium)

### 3.1. P0-C: Replace Cryptic RWR with an Integrated Tactical Radar / Minimap
* **The Problem:** The current bottom-right scope only displays military warning letters (`S`, `T`, `M`, `X`) for radiating SAMs. It does not show the aircraft carrier, enemy fighters, waypoints, or terrain.
* **The Redesign:** Upgrade the circular scope in [HUD.ts:1454](file:///d:/Git/Werapol/Game/Flight/src/renderer/HUD.ts#L1454) into a **Unified Tactical Radar**:
  1. **Carrier Homeplate:** Solid white box/triangle with bearing line and distance (e.g. `CV-68 8.4NM`).
  2. **Bandits:** Red triangles/chevrons pointing in their flight direction.
  3. **Target Waypoint:** Yellow diamond for the active mission objective.
  4. **SAM Threat Sectors:** Flashing red arc indicating missile radar lock.
  5. **Top Compass Tape:** North marker (`N`) rotating around the rim.

### 3.2. P0-D: Dynamic "Rookie Copilot" Contextual HUD Guidance Prompts
* **The Problem:** Beginners feel overwhelmed by 20+ static dials and do not know what buttons to press when an enemy approaches.
* **The Redesign:** Add a single, high-contrast, uncluttered prompt at the bottom-center of the HUD that changes dynamically based on combat state:
  - *Taking off:* `[SHIFT] AFTERBURNER — CLIMB TO 1000 FT`
  - *Bandit in forward arc:* `BANDIT DETECTED — PRESS [T] TO TARGET`
  - *Target locked:* `TARGET LOCKED (1.2 KM) — PRESS [SPACE] TO FIRE`
  - *SAM missile launch:* `WARNING: MISSILE! — PRESS [X] TO DROP CHAFF`
  - *Mission accomplished:* `SORTIE COMPLETE — PRESS [L] FOR CARRIER APPROACH`

---

## 4. Tier 2: Combat Legibility & Victory Progression (Player Impact: 8/10, Effort: Medium)

### 4.1. P1-E: In-Flight Death Slow-Motion & Legible Loss Sequence
* **The Problem:** When damage reaches 100%, `replaceAirframe()` instantly cuts to the 2D carrier deck management screen. The player has no idea what destroyed them.
* **The Fix:**
  1. Freeze or slow-mo time ($0.2\times$) for 2.5 seconds upon catastrophic damage.
  2. Pan the camera outside the aircraft showing the burning airframe spinning into the sea/canyon.
  3. Display a bold HUD callout: `MAYDAY! AIRFRAME DESTROYED BY MiG-23 CANNON FIRE`.
  4. Only then transition to the deck or debrief screen.

### 4.2. P1-F: Rookie First-Sortie Victory Milestone ("Operation Iron Gate")
* **The Problem:** Rookies repeatedly die in endless defense sorties and feel they cannot achieve victory.
* **The Fix:**
  - Structure Scenario 1 (`TRAINING_SORTIE` / `FIRST_LIGHT`) into three crisp, achievable milestones:
    - **Stage 1:** Fly down the valley and splash 2 target drones.
    - **Stage 2:** Drop chaff to defeat a simulated training SAM.
    - **Stage 3:** Trap aboard the carrier (assisted via `[L]` Recovery Guidance).
  - Award an immediate **"WINGS OF GOLD: COMBAT QUALIFIED"** victory debrief with pilot score fanfare.

---

## 5. Tier 3: Exciting Branching Terrain (Player Impact: 7/10, Effort: Medium-High)

### 5.1. P2-G: Branching Fjords & Valley Dogfighting Map
* **The Problem:** `FJORD` is a 1-dimensional straight corridor $|X| < 500$ m wide. Straying outside slams into 1800 m vertical cliffs.
* **The Solution:**
  - Create a new map `ARCTIC_ARCHIPELAGO` / `SERPENTINE_CANYON`:
    - Sinuous S-curves and branching tributaries where players can bank $60^\circ$ through mountain gaps.
    - Sea-level passages between offshore islands.
    - Natural radar masking valleys where hugging the deck allows sneaking past enemy air defense radar belts.

---

## 6. What to Cut (Simplicity Over Engineering Purity)

1. **Cut the 22-Instrument Sim HUD as Default:** Make the clean **Arcade HUD** the universal default. Retain the dense PRO HUD strictly behind a toggle for hardcore flight enthusiasts.
2. **Eliminate Obscure Screen Style Modes:** Maintain the single, polished `MODERN` vector bloom aesthetic (already started in v1.5.0) rather than offering confusing visual ladders.
3. **Remove Instant Death on Inadvertent Stall:** Add aerodynamic stall recovery assistance so low-speed manoeuvres give warning vibrations rather than an unrecoverable plunge.
