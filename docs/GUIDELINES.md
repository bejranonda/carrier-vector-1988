# Engineering Guidelines: CARRIER VECTOR: 1988

## 1. Zero External 3D Engine Policy
- **No Third-Party 3D Libraries:** Never introduce Three.js, Babylon.js, Pixi.js, or math libraries like gl-matrix.
- **Pure Linear Algebra:** All matrix rotations, transformations, line clipping, and vector operations must be implemented natively.
- **Single Canvas 2D Context:** All wireframe vectors are drawn via standard HTML5 2D canvas context (`beginPath`, `moveTo`, `lineTo`, `stroke`) with shadow-based phosphor bloom.

## 2. Aerodynamics & Physics Guardrails
- **Fixed Timestep Sensitivity:** Physics updates must operate with clamped $\Delta t$ ($\le 0.1\text{s}$) to avoid numerical instability or tunneling through terrain.
- **AoA Stall Separation:** Lift and control authority must always be functions of dynamic Angle of Attack ($\alpha$), not raw pitch orientation.
- **Energy Conservation:** High-G maneuvers must always bleed airspeed via induced drag $C_{Di}$. Free energy generation is strictly forbidden.
- **Mass & Payload Coupling:** Aircraft mass must dynamically incorporate remaining JP-5 fuel and ordnance weight (Vulcan ammo, Sidewinders, Mk.82 bombs).

## 3. Rendering & Performance Optimization
- **Near-Plane Clipping:** Any line segment intersecting the camera near plane ($z < 2.0\text{ m}$) must be mathematically clipped prior to perspective divide.
- **Distance Culling:** Wireframe terrain vertices beyond $8000\text{ m}$ must be culled to preserve 60 FPS performance on lower-tier hardware.
- **Garbage Collection Prudence:** Avoid instantiating temporary objects within inner rendering loops (`requestAnimationFrame`). Reuse static vector references when possible.

## 4. CRT Phosphor Aesthetics
- **Monochrome Green Palette:**
  - Primary vector phosphor: `#00ff66`
  - High ridge wireframes: `#33aa33`
  - Valley / low terrain: `#004400`
  - Background dark phosphor: `#051008`
- **Warning & Threat Colors:**
  - SAM nodes / MiG-23 hostiles / Missile launch: `#ff3333`
  - Radar lock / Afterburner / Bomb ordnance: `#ffaa00`
- **Glow & Bloom:** Canvas `shadowBlur = 4` and `shadowColor` matching the stroke color emulates the electron bloom of vintage cathode ray tubes.

## 5. TypeScript & Testing Discipline
- **Verbatim Module Syntax:** Always use `import type { ... }` when importing interfaces or type aliases.
- **Headless Unit Tests:** Any new flight dynamic, carrier queue transition, or sensor formula must be accompanied by headless Vitest unit tests in `src/**.test.ts`.
- **Zero Lint / Compiler Warnings:** Maintain zero TypeScript compiler errors under `tsc --noEmit`.
