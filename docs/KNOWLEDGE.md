# Knowledge Base: CARRIER VECTOR: 1988

## 1. Domain Summary
**CARRIER VECTOR: 1988** is an autonomous dual-loop simulation game coupling macro carrier strike group logistics with fixed-timestep 3D micro vector flight combat. It runs in browser environments using pure linear algebra without external 3D engines, delivering authentic 1980s CRT green phosphor aesthetics and procedural Web Audio SFX.

---

## 2. Core Mathematical Identifiers

### Coordinate System
- Right-handed Cartesian world coordinates:
  - $+X$: East (Right)
  - $+Y$: Altitude (Up, Mean Sea Level $= 0$)
  - $+Z$: North (Forward)

### 3D Projection Matrices
- Inverted Camera Rotation Matrix $\mathbf{R} = \mathbf{R}_z(-\phi) \mathbf{R}_x(-\theta) \mathbf{R}_y(-\psi)$
- Camera Translation $\mathbf{T} = \mathbf{P}_{world} - \mathbf{C}_{cam}$
- Camera Space coordinates: $\mathbf{P}_{cam} = \mathbf{R} \cdot \mathbf{T}$
- Near-plane threshold: $z_{near} = 2.0\text{ m}$
- Perspective Divide:
  $$x_{screen} = \frac{x \cdot f}{z} + \frac{W}{2}, \quad y_{screen} = -\frac{y \cdot f}{z} + \frac{H}{2}$$

### Flight Aerodynamics
- Dynamic Angle of Attack:
  $$\alpha = -\arcsin\left(\frac{\mathbf{v} \cdot \mathbf{u}_{up}}{|\mathbf{v}|}\right)$$
- Critical Stall Boundary: $\alpha_{crit} = 18^\circ$ ($0.314\text{ rad}$)
- Control Authority:
  $$\text{Authority} = \begin{cases} 1.0 & \text{if } |\alpha| \le \alpha_{crit} \\ 0.22 & \text{if } |\alpha| > \alpha_{crit} \end{cases}$$
- Dynamic Pressure: $q = \frac{1}{2} \rho v^2$, where $\rho = \rho_0 e^{-y / 8500}$
- Induced Drag under G-load:
  $$C_{Di} = \frac{C_L^2}{\pi e AR} \times \left[1 + (G - 1)^{1.8} \times 0.35\right]$$
- Fuel Burn Scaling:
  $$\dot{m}_{fuel} = \dot{m}_{base} \times \min(1.0, \text{throttle}) \times (\text{throttle} > 1.0 ? 3.5 : 1.0)$$

### Sensor Math & RCS
- Aspect Angle $\beta$ between aircraft nose $\mathbf{u}_{fwd}$ and radar line-of-sight vector $\mathbf{u}_{radar}$:
  $$\beta = \arccos(\mathbf{u}_{fwd} \cdot \mathbf{u}_{radar})$$
- Effective Radar Cross Section:
  $$\text{RCS}_{eff} = \text{RCS}_{base} \times \left[|\sin\beta| \cdot 1.5 + |\cos\beta| \cdot (\text{head-on ? } 0.7 : 1.4)\right] \times (\text{Bay Open ? } 4.0 : 1.0)$$

---

## 3. Macro Carrier Logistics State Machine
- Aircraft Lifecycle:
  `HANGAR_MAINTENANCE` $\to$ `ARMING_REFUELING` $\to$ `CATAPULT_READY` $\to$ `CATAPULT_LAUNCHING` $\to$ `AIRBORNE` $\to$ `RECOVERY_TRAP` $\to$ `DAMAGED_REPAIR`
- Crew Stamina:
  Four distinct crew colors with fatigue degradation down to $10\%$ stamina under sustained sortie tempos.
- Consequence Accounting:
  - Unintercepted bombers inflict $-35\%$ hull damage and consume 1 airframe.
  - Dry fuel tank landings consume 1 airframe and inflict $-10\%$ hull damage.
  - Weapon expenditures directly deplete carrier ammunition and fuel stocks.

---

## 4. Web Audio Synthesis Specifications
- **Turbine Whine:** Sawtooth wave ($70-210\text{ Hz}$) through low-pass filter ($250-850\text{ Hz}$).
- **Afterburner:** Synthesized white noise through band-pass filter ($400\text{ Hz}$, $Q=1.0$).
- **RWR Audio States:**
  - `SEARCH`: Pulsed $750\text{ Hz}$ tone ($1.2\text{s}$ interval).
  - `TRACK`: Rapid $1200\text{ Hz}$ ping ($220\text{ms}$ interval).
  - `LAUNCH`: Continuous alternating $1600\text{ Hz} / 1100\text{ Hz}$ dual-tone klaxon.
