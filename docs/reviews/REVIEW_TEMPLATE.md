# Standardized Game Review & Evaluation Protocol (21-Dimension Framework)

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

## 0. Player Evidence (MANDATORY — fill this in first)

> **This section outranks everything below it.** In the v1.5.0-dev review, three
> verbatim sentences from one human playtester identified more real defects than
> the entire preceding review suite. Code reading finds *what is*; players find
> *what hurts*.

**Verbatim confusions** (do not paraphrase, do not tidy the grammar):

```
1. "..."
2. "..."
3. "..."
```

**For each, answer honestly before writing anything else:**

| # | Player said | Is this a misunderstanding, or a missing feature? | Evidence (`file:line`) |
| :---: | :--- | :--- | :--- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

> **If this section is empty, say so explicitly at the top of the review and
> down-weight every conclusion accordingly. Never invent player experience.**
>
> **Rule of thumb:** if most player confusions turn out to be missing features
> rather than misunderstandings, stop reviewing and start building — the backlog
> is speaking through the player.

---

## 1. The 21-Dimensional Evaluation Framework

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

### 1.13. Cognitive Load, Visual Hierarchy & Progressive Disclosure (Sim vs. Arcade HUD)
* **Screen Density & Foveal Focus:** Are there too many simultaneous instruments competing for the player's attention?
* **Progressive Disclosure:** Does the game offer a clean, simplified "Arcade HUD" for beginners and a full 22-instrument "Sim HUD" for veterans?
* **Focal Point Clarity:** Can a novice immediately identify the single most important action to take at any second?

### 1.14. Desktop Input Ergonomics & Multi-Modal Control (Mouse / Keyboard / Hybrid)
* **Desktop Pointer Interactivity:** Can mouse users click HUD weapon pills, assist toggles, deck operations, and briefing buttons?
* **Click-to-Action Feedback:** Do interactive buttons provide visual hover states and tactile acoustic feedback?
* **Alternative Flight Input:** Is there support or assist for mouse-yoke steering or virtual joystick control on desktop browsers?

### 1.15. Entertainment-to-Frustration Ratio ("Time-to-Fun" & Dopamine Delivery)
* **Time-to-First-Fun:** How many seconds elapse between landing on the webpage and experiencing genuine excitement (a kill, a high-speed canyon dive)?
* **Reward vs. Penalty Balance:** Does the game reward minor successes (hits, close evasion) or only punish aerodynamic mistakes?
* **The "Flow State" Index:** Does the player feel empowered like a fighter ace, or overwhelmed like a student pilot taking an exam?

---

### 1.16. Defensive Counterplay & Threat-Response Vocabulary
> *Added v1.5.0-dev. Existing pillars measured frustration **level** but not its **cause** — they could not tell "hard but fair" apart from "no counterplay exists".*

* **Threat-to-Verb Mapping:** For every way the game can hurt the player, list the action the player may take in response. **Any threat with zero verbs is a P0 defect.**
* **Counterplay Solvability:** Is the response a skill (timing, positioning, resource spend) or a coin flip on environment?
* **Enemy Weapon Fairness:** Do hostile projectiles obey physical limits — turn rate, energy bleed, seeker FOV, minimum range — or are they undodgeable by construction?
* **Last-Ditch Options:** Does the player have a final desperate move (countermeasure, break turn, terrain dive) that *sometimes* works?

### 1.17. Control Convention Conformance & Muscle-Memory Transfer
> *Added v1.5.0-dev. Pillar 14 covered input **ergonomics** (can I click it?), never input **semantics** (does it do what the genre trained me to expect?).*

* **Genre Convention Audit:** Compare every axis and core binding against the established defaults of the genre (MSFS, X-Plane, DCS, IL-2, Ace Combat).
* **Deviation Justification:** Where the game deviates, is it deliberate and documented, or accidental?
* **Discoverability of the Fix:** If a convention toggle exists, how many actions does it take a confused player to find it? **More than one is too many.**
* **Terminology Safety:** Avoid ambiguous labels ("inverted"). Prefer behavioural phrasing (`UP = DIVE` / `UP = CLIMB`).

### 1.18. Tactical Toolset Completeness (Means-Ends Coverage)
> *Added v1.5.0-dev. No prior pillar asked "does the player own an appropriate tool for the objective the game just set?" — which is how a SEAD mission shipped without SEAD weapons.*

* **Objective-to-Tool Matrix:** For every mission objective, name the intended tool and verify it exists in code.
* **Doctrinal Plausibility:** If the mission invokes a real-world doctrine (SEAD, CAP, interdiction), does it supply that doctrine's defining equipment?
* **Dead Tools:** Any weapon that cannot affect any objective (e.g. an air-to-air missile in a ground-attack mission) is a design smell.
* **RELEASE GATE:** *No mission ships until the tool that mission implies exists.*

### 1.19. Teachability & Diegetic Discoverability
> *Added v1.5.0-dev. Pillar 7 covered onboarding **pacing**, never whether a mechanic is **learnable at all** without external documentation.*

* **Zero-Docs Learnability:** Which mechanics can a player discover purely by playing? Which require reading the README?
* **Instruction Correctness:** **Every key named in tutorial or mission prose must be verified against `CONTROL_SCHEMA`.** An incorrect instruction is worse than no instruction.
* **Tutorial Validation Integrity:** Does each tutorial step verify the *actual* skill, or does it pass on a timer?
* **Progressive Disclosure of Bindings:** Are all 40+ keys presented at once, or chunked by mission?

### 1.20. Failure Legibility & Death Post-Mortem
> *Added v1.5.0-dev. Nothing previously measured whether the player understands **why** they died — the primary rage-quit driver in combat games.*

* **Causal Clarity:** On death, is the killer, the range, and the mistake named?
* **Corrective Guidance:** Is the player told what to do differently next time?
* **Silent Failures:** Are there deaths with no visible cause (off-screen hit-scan, invisible projectile)? Each is a P1 defect.
* **Recoverability:** Does a mistake cascade instantly into loss, or is there a window to save it?

### 1.21. Accessibility, Remappability & Inclusive Design
> *Added v1.5.0-dev. The colour-blind palette was tracked nowhere in the rubric, and absent key remapping was invisible to all 15 prior pillars.*

* **Key Remapping:** Can bindings be reassigned and persisted? **Verify against non-QWERTY layouts** — `WASD`/`QE` sit in different physical positions on AZERTY and QWERTZ.
* **Visual Accessibility:** Colour-blind palettes, contrast ratios, minimum font size at the smallest supported viewport.
* **Motion Sensitivity:** Is there a reduced-motion mode damping camera shake and CRT warp?
* **Motor Accessibility:** Are simultaneous-key-press requirements avoidable? Is one-handed play possible?
* **Difficulty as Accessibility:** Do assist modes let a low-skill player finish the content rather than merely survive longer?

---

## 2. Standardized 21-Pillar Scoring Rubric

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
| **13. Cognitive Load & Visual Hierarchy** | `/ 10` | `/ 10` | `+/-` | Sim vs. Arcade HUD density, progressive disclosure, visual calm. |
| **14. Desktop Mouse & Input Ergonomics** | `/ 10` | `/ 10` | `+/-` | Mouse hit-areas, clickable HUD & deck buttons, hybrid control. |
| **15. Entertainment-to-Frustration Ratio** | `/ 10` | `/ 10` | `+/-` | Time-to-fun, dopamine delivery vs. aerodynamic homework. |
| **16. Defensive Counterplay** | `/ 10` | `/ 10` | `+/-` | Threat-to-verb mapping, enemy weapon fairness, last-ditch options. |
| **17. Control Convention Conformance** | `/ 10` | `/ 10` | `+/-` | Genre-standard axes, deviation justification, toggle discoverability. |
| **18. Tactical Toolset Completeness** | `/ 10` | `/ 10` | `+/-` | Objective-to-tool matrix, doctrinal plausibility, dead tools. |
| **19. Teachability & Discoverability** | `/ 10` | `/ 10` | `+/-` | Zero-docs learnability, instruction correctness, step validation. |
| **20. Failure Legibility & Post-Mortem** | `/ 10` | `/ 10` | `+/-` | Causal clarity on death, corrective guidance, silent failures. |
| **21. Accessibility & Remappability** | `/ 10` | `/ 10` | `+/-` | Remapping, non-QWERTY layouts, colour-blind, reduced motion. |
| **ENGINEERING INDEX** | `/ 10` | `/ 10` | `+/-` | Pillars 1, 10, 12 — physics rigour, performance, architecture. |
| **COMPOSITE PLAYER ENTERTAINMENT INDEX** | `/ 10` | `/ 10` | `+/-` | **Holistic weighted score balancing fun, accessibility, and tech.** |

> **Caution on precision.** Do not report two decimal places on a subjective
> judgement — `8.85` is not more honest than `9`, it merely discourages argument.
> Consider a `SHIP IT / NEEDS WORK / BROKEN` band per pillar and reserve the
> numeric index for cross-version trend tracking only.

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
