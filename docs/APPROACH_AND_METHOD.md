# Approach & Method: CARRIER VECTOR: 1988

## 1. Core Philosophy & Design Strategy
The architecture of **CARRIER VECTOR: 1988** resolves the dichotomy between high-level tactical management (Macro Layer) and visceral, low-altitude wireframe dogfighting (Micro Layer) within a unified deterministic loop. 

A strict constraint governed all engineering decisions: **zero external 3D engine dependencies**. The entire 3D camera projection, near-plane frustum clipping, wireframe rasterization, and 6-DOF physics were designed using pure linear algebra.

---

## 2. Dual-Loop Architecture

### The Macro Layer (Carrier Deck & Logistics Engine)
- **Queuing State Machine:** Aircraft cycle through deterministic states:
  $$\text{HANGAR\_MAINTENANCE} \longrightarrow \text{ARMING\_REFUELING} \longrightarrow \text{CATAPULT\_READY} \longrightarrow \text{CATAPULT\_LAUNCHING} \longrightarrow \text{AIRBORNE} \longrightarrow \text{RECOVERY\_TRAP} \longrightarrow \text{DAMAGED\_REPAIR}$$
- **Deck Crew Dynamics:** Four specialized crew teams (Ordnance, Fuel, Catapult, Mechanics) maintain stamina and fatigue metrics. Fatigue degrades turnaround speed by up to $60\%$.
- **Threat Director & Early Warning Radar:** Enemy strike packages advance along a continuous time-to-impact continuum. Breaching the $130\text{s}$ outer perimeter triggers the **SCRAMBLE ALERT**. Unintercepted bombers directly damage carrier hull integrity and consume spare airframes.

### The Micro Layer (6-DOF Flight Sim & Tactical Radar)
- **State Vector:** Position $(x, y, z)$, Velocity $\mathbf{v}$, and orientation Euler angles $(\theta, \phi, \psi)$.
- **Dynamic Angle of Attack ($\alpha$):** Rather than artificial pitch rates, $\alpha$ is derived from the scalar projection of the normalized velocity vector on the aircraft's longitudinal and vertical axes.
- **Critical Stall Boundary:** When $|\alpha| > 18^\circ$, lift collapses to post-stall drag values and control surface authority drops to $0.22$, preventing artificial high-alpha turns without kinetic energy.
- **G-Induced Kinetic Bleed:** Hard banked turns increase induced drag quadratically with G-load, penalizing prolonged high-G maneuvering.
- **Terrain Masking Raycast:** 3D line-of-sight checks interpolate between ground SAM radars and the aircraft against the procedural canyon elevation map. Flying in canyons cuts radar lock, updating RWR states from `TRACK`/`LAUNCH` to `STATUS: TERRAIN MASKED`.

---

## 3. Pure Linear Algebra 3D Vector Projection Pipeline

### Step 1: Camera Transformation
For world coordinates $\mathbf{P}_w$ and camera position $\mathbf{C}$:
$$\Delta\mathbf{P} = \mathbf{P}_w - \mathbf{C}$$

Rotate by inverted camera angles around $Y$ (Yaw $\psi$), $X$ (Pitch $\theta$), and $Z$ (Roll $\phi$):
$$\begin{aligned}
x_1 &= \Delta x \cos(-\psi) + \Delta z \sin(-\psi) \\
z_1 &= \Delta z \cos(-\psi) - \Delta x \sin(-\psi) \\
y_2 &= \Delta y \cos(-\theta) - z_1 \sin(-\theta) \\
z_2 &= z_1 \cos(-\theta) + \Delta y \sin(-\theta) \\
x_3 &= x_1 \cos(-\phi) - y_2 \sin(-\phi) \\
y_3 &= x_1 \sin(-\phi) + y_2 \cos(-\phi)
\end{aligned}$$

### Step 2: Near-Plane Line Clipping
To avoid visual blow-outs when lines cross behind the camera ($z \le 0$), all line segments $(\mathbf{A}, \mathbf{B})$ spanning across $z_{near} = 2.0\text{ m}$ are dynamically clipped:
$$t = \frac{z_{near} - z_A}{z_B - z_A}, \quad \mathbf{A}' = \mathbf{A} + t(\mathbf{B} - \mathbf{A})$$

### Step 3: Perspective Divide
Screen projection with focal length $f$:
$$x_{screen} = \frac{x_3 \cdot f}{z_2} + x_0, \quad y_{screen} = -\frac{y_3 \cdot f}{z_2} + y_0$$

---

## 4. Procedural Audio Synthesis (Web Audio API)
To preserve the 1980s aesthetic, no pre-recorded audio samples are used:
1. **Engine Whine:** Sawtooth oscillator through a low-pass filter modulated by throttle ($70\text{ Hz} \to 210\text{ Hz}$).
2. **Afterburner Roar:** Procedural white noise buffer passed through a band-pass filter ($400\text{ Hz}$, $Q=1.0$), engaged when throttle $> 1.0$.
3. **RWR Tones:** 
   - `SEARCH`: Pulsed $750\text{ Hz}$ tone.
   - `TRACK`: Rapid $1200\text{ Hz}$ ping.
   - `LAUNCH`: Warbling $1600\text{ Hz} / 1100\text{ Hz}$ dual-tone klaxon.
4. **Weapons & Explosions:** Exponential frequency-ramping oscillators and noise shaping.
