# Standardized Game Review & Evaluation Protocol (12-Dimension Framework)

> **Purpose:** Authoritative multi-dimensional evaluation framework for assessing new versions and major releases (e.g., `v1.4.0`, `v2.0.0`) of **Carrier Vector: 1988**.  
> **Directory Convention:** Store version evaluations in `docs/reviews/v<Version>/` (e.g., `docs/reviews/v1.4.0/COMPREHENSIVE_GAME_REVIEW.md`).  
> **Target Audience:** Game designers, product managers, QA testers, and autonomous AI development agents.

---

## Review Metadata
* **Evaluated Version:** `vX.Y.Z`
* **Evaluation Date:** `YYYY-MM-DD`
* **Reviewer / Agent:** `[Name / Agent ID]`
* **Git Commit SHA:** `[Commit Hash]`
* **Live Deployment Tested:** `https://bejranonda.github.io/carrier-vector-1988/` (or local preview)
* **Test Suite Pass Rate:** `[e.g., 758 tests passed / 0 failures]`
* **Test Environments:** `[e.g., Desktop Chrome 128 (144Hz), Mobile Safari iOS 17.5, Firefox Linux]`

---

## 1. The 12-Dimensional Evaluation Framework

### 1.1. Live Web Build, First 60 Seconds & Interaction Telemetry
* **Boot-to-Cockpit Latency:** How many milliseconds elapsed from page load to sitting on the catapult?
* **First 60s Psychological Impression:** Does the boot sequence, CRT curvature, and catapult stroke trigger immediate awe, or cognitive confusion?
* **Interaction Latency:** Input-to-photon latency across mouse, keyboard, touch, and gamepad inputs.

### 1.2. Aerodynamic Rigor, Flight Dynamics & Zero-Dependency Physics
* **Zero-Dependency Compliance:** Confirm runtime npm dependency count is strictly zero.
* **Physics Authenticity:** Evaluation of induced drag, symmetric stall envelopes, dynamic pressure (`q = ½ρv²`), and Mach drag rise.
* **Numerical Integrity:** Fixed-timestep (`FIXED_DT = 1/120s`) stability, semi-implicit Euler integration, and swept-sphere missile proximity fuzing.

### 1.3. Game Loop Cadence & Dopamine Architecture
* **Micro-Loop (0–5s):** Aiming boresight, weapon lock-on, trigger squeeze, hit confirmation, and immediate visual feedback.
* **Meso-Loop (30–90s):** Target designation, energy management, defensive terrain-masking dives, and evasion.
* **Macro-Loop (5–15 min):** Catapult launch, strike execution, carrier approach/trap, rearm/repair turnaround.
* **Meta-Loop (Long-Term):** Campaign progression, persistent airframe attrition, pilot rank, and unlockables.

### 1.4. Spatial Awareness, Camera Dynamics & Situational Telemetry
* **Cockpit Field of View (FOV):** Is the 60° forward FOV sufficient, or does the player feel blind during vertical scissors and high-G dogfights?
* **Padlock / Target-Tracking View:** Can the player hold a key to slave the camera to the designated contact, or must they rely solely on 2D radar?
* **HUD Telemetry Usability:** Does the pitch ladder, flight path marker (FPM), and AoA bracket scale correctly with `fov · tan(Δangle)`?

### 1.5. Soundscape, Acoustic Dramaturgy & Cockpit Voice Alerts
* **Procedural Synthesis Quality:** Fidelity of FM/subtractive synthesized jet engines, afterburner rumble, cannon cracks, and missile launches.
* **3D Audio Spatialization:** Accuracy of stereo panning and distance attenuation for threats (e.g., SAM launches off the wing).
* **Cockpit Voice Warning System ("Bitchin' Betty"):** Presence of synthesized audio warnings (*"PULL UP"*, *"WARNING: MISSILE"*, *"STALL"*, *"OVER-G"*).
* **Tactical Radio Chatter & Brevity Codes:** Use of authentic Cold War radio comms (*"Fox Two"*, *"Spike"*, *"Mud"*, *"Splash"*).

### 1.6. Kinetic "Game Feel", Juice & Visceral Destruction
* **Destruction Payoff:** Do exploding targets shatter into independent physical vector line debris, or do they sterilely vanish?
* **Haptic & Visual Punch:** Screen-shake intensity, camera recoil impulses, CRT scanline tearing, and bloom flare during detonations.
* **Near-Miss Feedback:** Visual and acoustic shockwaves when supersonic missiles or flak burst close to the canopy.

### 1.7. Narrative Immersion, Cold War Atmosphere & Dynamic Sortie Events
* **Worldbuilding & Atmosphere:** Authenticity of the 1988 Norwegian Sea NATO/Soviet theater of operations.
* **Narrative Delivery:** Is lore integrated through diegetic wingman comms and tactical briefings, or dry static text?
* **Mid-Mission Reactive Drama:** Do sorties feature unexpected events (scramble alerts, pop-up SAMs, radar jamming, divert orders)?

### 1.8. Player Churn Analysis, Mastery Curve & Non-Lethal Onboarding
* **Second-by-Second Churn Risk:** Timestamped identification of where new players quit (e.g., Second 12 SAM ambush, Minute 3 carrier crash).
* **Onboarding Safety:** Is the tutorial isolated in safe airspace, or are players forced to learn flight controls under live fire?
* **Skill Floor vs. Skill Ceiling:** How smoothly does a player transition from `AUTOPILOT` to `ASSIST` to `MANUAL` flight?

### 1.9. Strategic Agency, Risk/Reward Economy & Deck Operations
* **Deck Decision Depth:** Does carrier turnaround offer high-stakes choices with tradeoffs, or is it a passive timer waiting room?
* **Aircraft & Ordnance Triage:** Does payload weight penalize climb rate and fuel consumption?
* **EMCON (Emissions Control) Stealth:** Can the player shut down radar to hide from SAMs at the cost of situational awareness?

### 1.10. Performance, Frame Pacing, Memory & Mobile Thermals
* **Display Ladder Stability:** Frame pacing consistency across 60Hz, 120Hz, and 144Hz monitors without physics drift.
* **Canvas2D Render Duration:** Per-frame render time across `RETRO` (shadowBlur) and `MODERN` (bloom buffer) modes.
* **Garbage Collection (GC) Footprint:** Zero-allocation verification in the hot simulation path.
* **Mobile Thermals & Battery:** Thermal throttling and battery drain during extended multi-sortie sessions.

### 1.11. Marketability, Social Currency & Streamability
* **The "5-Second Hook":** Can a 5-second clip captivate viewers on TikTok, YouTube Shorts, or X?
* **Unique Selling Proposition (USP):** How distinctly does the game stand out against competitors (*Tiny Combat Arena*, *Nuclear Option*)?
* **Post-Mission Social Artifacts:** Shareability of the Daily Sortie card and potential for retro "Gun-Camera VHS Replay" exports.

### 1.12. Architectural Health, Headless Testing & AI Safe-Extensibility
* **AI Safe-Modification Index:** Can an autonomous LLM refactor mechanics without breaking visual or physics contracts?
* **Automated Test Coverage:** Quantity and breadth of headless Vitest unit and integration tests.
* **Purity of Logic:** Absolute decoupling of simulation state machines from rendering contexts.

---

## 2. Standardized 12-Pillar Scoring Rubric

Compare current evaluation against the previous release baseline:

| Pillar | Previous (`vPrev`) | Current (`vCurr`) | Delta (Δ) | Evaluation Summary & Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **1. Flight Dynamics & Aerodynamics** | `/ 10` | `/ 10` | `+/-` | 6-DOF model, induced drag, stall envelope, terrain masking. |
| **2. Loop Cadence & Dopamine Architecture**| `/ 10` | `/ 10` | `+/-` | Micro, meso, macro, and meta-loop reward rhythms. |
| **3. Spatial Awareness & Camera Dynamics** | `/ 10` | `/ 10` | `+/-` | Cockpit FOV, padlock tracking, situational awareness. |
| **4. Soundscape & Cockpit Voice Alerts** | `/ 10` | `/ 10` | `+/-` | Procedural audio, Bitchin' Betty, brevity codes, 3D pan. |
| **5. Visual "Game Feel" & Kinetic Juice** | `/ 10` | `/ 10` | `+/-` | Vector debris physics, camera shake, visual hit feedback. |
| **6. Narrative Atmosphere & Dynamic Sorties**| `/ 10` | `/ 10` | `+/-` | Cold War immersion, radio chatter, reactive mid-mission events. |
| **7. Onboarding, Pacing & Churn Prevention**| `/ 10` | `/ 10` | `+/-` | Non-lethal training, checklist removal, churn mitigation. |
| **8. Strategic Agency & Deck Operations** | `/ 10` | `/ 10` | `+/-` | Carrier turnaround tradeoffs, resource triage, deck depth. |
| **9. Campaign Stakes & Meta Retention** | `/ 10` | `/ 10` | `+/-` | Persistent airframe loss, node-based Rogue-lite campaign map. |
| **10. Performance, Frame Pacing & Thermals**| `/ 10` | `/ 10` | `+/-` | Fixed timestep stability, Canvas2D budget, mobile thermals. |
| **11. Marketability & Social Streamability**| `/ 10` | `/ 10` | `+/-` | 5-second hook, viral clip appeal, gun-camera export. |
| **12. Architectural Health & AI Safety** | `/ 10` | `/ 10` | `+/-` | Zero dependencies, 750+ tests, pure logic decoupling. |
| **COMPOSITE PLAYER ENTERTAINMENT INDEX** | `/ 10` | `/ 10` | `+/-` | **Holistic weighted score balancing fun and tech.** |

---

## 3. Systematic Breakdown: Improvements vs. Regressions

### What Improved in this Version
* *Improvement 1:*
* *Improvement 2:*

### What Remains Flawed or Regressed
* *Friction Point 1:*
* *Friction Point 2:*

---

## 4. Prioritized Actionable Roadmap
* **P0 (Critical for Player Retention):** Immediate fixes for high-churn bottlenecks and hostile onboarding.
* **P1 (High Impact - Game Feel & Audiovisuals):** Sensory upgrades, voice warnings, and visceral explosion juice.
* **P2 (Strategic Architecture & Meta-Game):** Rogue-lite persistent campaign and padlock camera dynamics.

---

## 5. Directives & Master Prompts for Future AI Tasks
*(Include exact copy-paste prompts enforcing zero-dependency, test-driven, and mathematical guardrails).*
