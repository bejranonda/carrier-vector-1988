# Known Issues & Considerations: CARRIER VECTOR: 1988

### 1. Browser Web Audio Autoplay Policy
- **Behavior:** Modern browsers automatically block audio contexts until the user performs an explicit interaction on the page.
- **Handling:** An unlock listener on `window.addEventListener('keydown' | 'mousedown')` activates the procedural Web Audio API nodes (`SoundFX.ts`) on the user's first keystroke or click.
- **Note:** If testing without initial interaction, flight and RWR audio will remain silent until a key is pressed.

### 2. Euler Angle Gimbal Singularity Avoidance
- **Behavior:** Pure Euler representation of 3D rotations (Pitch $\theta$, Roll $\phi$, Yaw $\psi$) suffers from mathematical gimbal lock when pitch approaches $\pm 90^\circ$.
- **Handling:** Pitch is intentionally clamped to $[-88^\circ, +88^\circ]$ in `applyPitchInput()`. This prevents visual inversion while preserving full tactical combat aerobatics.
- **Future Improvement:** Transition to unit quaternion orientation tracking for full $360^\circ$ loop-the-loop maneuvers.

### 3. Screen Frustum vs. Near-Plane Line Clipping
- **Status:** **Near-plane clipping ($z \ge 2.0\text{ m}$) is fully implemented and tested.**
- **Edge Behavior:** Left/Right/Top/Bottom screen edge clipping relies on the HTML5 2D canvas hardware scissor box. Extremely long lines crossing beyond screen boundaries are safely clipped by the canvas rasterizer without division-by-zero or negative-depth artifacts.

### 4. Carrier Deck Trap Tolerances
- **Behavior:** The carrier arresting gear recovery envelope requires:
  - Distance to carrier $\le 180\text{ m}$
  - Altitude $18\text{ m} \le Y \le 28\text{ m}$ (flight deck elevation is $20\text{ m}$)
  - Airspeed $\le 90\text{ m/s}$ ($\approx 175\text{ kts}$)
- **Penalty:** Arriving with $0\text{ L}$ fuel triggers an emergency foam crash landing, consuming 1 spare airframe and damaging flight deck facilities.

### 5. Multi-Core Performance with Complex Terrain
- **Behavior:** On lower-power mobile GPUs, canvas vector bloom (`shadowBlur = 4`) combined with CSS scanlines can induce minor frame drops if too many lines are rendered.
- **Handling:** The terrain mesh generator employs distance culling at $8000\text{ m}$ and samples every second coordinate cell ($2\times$ stride) to ensure a steady 60 FPS on standard desktop displays.
