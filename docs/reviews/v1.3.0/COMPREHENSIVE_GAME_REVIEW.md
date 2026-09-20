# Carrier Vector 1988: Comprehensive Game Review (v1.3.0 Baseline)

> **Evaluated Version:** `v1.3.0`  
> **Evaluation Date:** 2026-09-20  
> **Reviewer Profile:** Senior Game Designer & Systems Architect (Combat Flight Simulators & Tactical Strategy)  
> **Live Deployment Tested:** `https://bejranonda.github.io/carrier-vector-1988/`  
> **Test Suite Status:** 758 tests passed across 38 suites (100% headless pass)  
> **Evaluation Standard:** 10-Pillar Standardized Protocol ([`REVIEW_TEMPLATE.md`](../REVIEW_TEMPLATE.md))

---

## 1. Multi-Dimensional Evaluation

### 1.1. Live Web Build & Session Telemetry
* **The First 60 Seconds:** Booting the web game delivers instant nostalgia. The CRT green glow, curvature distortion, and ambient carrier deck hum set an authentic 1980s tone. Launching off the catapult provides an immediate acoustic and visual adrenaline rush.
* **The Critical Friction Point (Known Issue #32):** During real-time playtesting of the live GitHub Pages build, a major onboarding failure was exposed. Upon takeoff, the player is presented with a "Flight Checkout" checklist. Intuitively, any player flying a supersonic aircraft pulls back on the stick to climb. Climbing past 1,000 ft breaks the terrain-masking radar shadow. Within 10–12 seconds of launch—while trying to read the checklist—the player is locked by an SA-6 SAM, the cockpit flashes red with `MISSILE LAUNCH — GET LOW`, and the jet is obliterated, dumping the player back to the deck.
* **Deck Pacing:** Post-sortie or upon ditching, the carrier deck loop feels detached from the flight action. Although the "Rush turnaround" mechanic adds interactivity, the deck remains largely an interactive waiting room governed by timers rather than a strategic command center.

### 1.2. Source Code, Math Rigor & Architectural Health
* **Zero-Dependency Compliance:** Hand-rolling a 6-DOF flight model, 3D vector projection pipeline, matrix transformations, and a Web Audio FM synthesizer in pure TypeScript with **zero runtime npm dependencies** is a masterclass in software engineering.
* **Numerical Stability:** The simulation is locked to a fixed timestep (`FIXED_DT = 1/120s`) using semi-implicit Euler integration. Projectile collision uses swept-volume segments, preventing supersonic SAMs (~48 m/tick) from tunneling through the aircraft's 40m fuze radius.
* **Decoupling Purity:** The boundary between pure mathematical state (`src/flight/AircraftPhysics.ts`, `src/carrier/DeckManager.ts`) and the view layer (`src/renderer/`, `src/audio/`) is absolute. All flight dynamics and state transitions run completely headless in Vitest without requiring a browser DOM.

### 1.3. Narrative, Cold War Atmosphere & Flow
* **Atmospheric Potential:** Setting the game in 1988 during a NATO/Soviet clash in the Norwegian Sea provides great narrative potential (reminiscent of Tom Clancy's *Red Storm Rising* and classic MicroProse sims).
* **Narrative Delivery Failure:** The narrative is currently conveyed almost exclusively through static briefing modal cards. There is no radio chatter, no speech synthesis, and no tactical drama. Once airborne, narrative engagement drops to zero until the mission debrief card.
* **Session Flow:** The session rhythm is jarring: **Briefing Modal → Catapult Launch → High-Stress Sortie → Debrief Modal**. The lack of transitional pacing (taxiing, elevator transitions, or post-mission intelligence summaries) makes sorties feel like isolated arcade vignettes.

### 1.4. The Psychology of Fun & Kinetic "Game Feel" (Juice)
* **Flow State Channel (Csíkszentmihályi):** Video game enjoyment thrives when challenge balances skill. *Carrier Vector* currently vacillates between low-agency waiting on the deck (boredom) and sudden death from off-screen SAMs (frustration).
* **Kinetic Payoff Deficit:** When an enemy Tu-16 Badger or SAM radar is destroyed, it sterilely disappears or pops. There is no vector fragmentation debris tumbling through 3D space, no camera-shake recoil, no electronic warfare radar static, and no acoustic crunch.
* **The Stakes Vacuum:** Because missions are isolated one-offs with infinite aircraft respawns, tactical decisions carry zero consequences. If a pilot dies, they restart with zero penalty to the carrier fleet.

### 1.5. Player Churn Analysis, Mastery Curve & Retention
* **Second-by-Second Churn Risk:** 
  * *Second 0–5:* High engagement (CRT boots, catapult launch).
  * *Second 12–15 (The Churn Cliff):* Extreme drop-off risk. New players get destroyed by SAMs while reading the tutorial checklist and close the tab.
  * *Minute 3–5:* Second churn cliff for players unable to master the manual carrier trap approach.
* **Skill Ceiling vs. Floor:** The skill floor is brutally high in `MANUAL` mode; `AUTOPILOT` successfully lowers the floor, but the game fails to teach players how to transition from autopilot back to manual flight.
* **Dopamine Cadence:** Dopamine events are sparse: long stretches of silent cruising punctuated by sudden panic. Kills do not feel sufficiently rewarding to balance the tension.

### 1.6. Ergonomics, Cognitive Load & Multi-Platform Accessibility
* **Desktop Ergonomics:** Keyboard controls require two hands stretched across 12+ separate keys (`W/S/A/D`, `Q/E`, `F`, `T`, `Y`, `Space`, `Enter`). While remappable, the cognitive load during high-G evasive maneuvers is exhausting.
* **Touch / Mobile Ergonomics:** The virtual thumb stick and tap-to-designate mechanics are brilliant. However, in portrait orientation on smaller phones, thumbs can occlude the altimeter and meatball glideslope indicator.
* **Accessibility Excellence:** Built-in colorblind palettes, flash-safe warnings, and reduced-motion modes demonstrate exceptional forethought.

### 1.7. Performance, Frame Pacing & Mobile Thermals
* **Refresh Rate Stability:** The fixed timestep accumulator flawlessly decouples simulation physics from display refresh rates, running smoothly across 60Hz, 120Hz, and 144Hz monitors.
* **Canvas2D Render Overhead:** Canvas shadow blur (`shadowBlur` for vector bloom) costs up to 23.7ms per frame on high-resolution displays in `RETRO` mode. The `MODERN` bloom pipeline (quarter-resolution offscreen pass) successfully mitigates this to ~16.7ms.
* **Garbage Collection (GC):** Zero allocation in the hot simulation path prevents micro-stutters during intense dogfights.

### 1.8. Marketability, Streamability & The "5-Second Hook"
* **Visual Uniqueness (The Hook):** The retro green wireframe aesthetic stands out immediately against modern 3D flight sims. A short clip of a nighttime carrier trap or canyon low-level run is highly shareable on TikTok, Reddit, and X.
* **The Killcam Void:** While flight looks stunning, dogfight kills look underwhelming. Without vector fragmentation explosions and screen shake, combat clips fail to produce viral excitement.
* **Daily Sortie Wordle Effect:** The Daily Sortie seed and share card provide a solid retention mechanic, but need richer emoji-based mission summary cards for social sharing.

### 1.9. Architectural Health & AI Extensibility
* **AI Safe-Modification Index:** Extremely high. Because physics and carrier states are strictly isolated from Canvas2D rendering and covered by 758 automated tests, an autonomous AI agent can safely refactor mechanics without breaking visual rendering.
* **Documentation Quality:** The repository documentation (`docs/GUIDELINES.md`, `docs/KNOWLEDGE.md`, `docs/APPROACH_AND_METHOD.md`) provides complete mathematical formulas and architectural rules.

---

## 2. Standardized 10-Pillar Scoring Rubric (v1.3.0 Baseline)

| Pillar | Score (v1.3.0) | Evaluation Summary & Rationale |
| :--- | :---: | :--- |
| **1. Flight Dynamics & Aerodynamics** | **8.5 / 10** | Exceptional 6-DOF physics, realistic induced drag, and authentic terrain-masking line-of-sight math. |
| **2. Carrier Deck Operations & Strategy** | **3.5 / 10** | Deck loop is essentially an interactive waiting room; lacks resource dilemmas or fleet positioning. |
| **3. UX, Controls & Ergonomics** | **8.0 / 10** | Decoupling flying from fighting via `AUTOPILOT` is a UX triumph; keyboard layout is wide. |
| **4. Audio, CRT Aesthetics & Immersion** | **7.5 / 10** | Procedural Web Audio and CRT bloom give a distinct identity; lacks dynamic musical momentum. |
| **5. Visual "Game Feel" & Kinetic Juice** | **5.5 / 10** | Hits and kills feel sterile; lacks vector particle debris, screen-shake impulses, and impact crunch. |
| **6. Onboarding, Pacing & Cognitive Load** | **3.0 / 10** | Hostile onboarding: presents an engineering checklist while being actively hunted by supersonic SAMs. |
| **7. Campaign Stakes & Replay Retention** | **3.5 / 10** | Missions are isolated one-offs; zero consequences for lost aircraft; no overarching campaign. |
| **8. Performance, Frame Pacing & Thermals**| **8.5 / 10** | Fixed timestep runs flawlessly; hot path avoids GC pauses; retro shadow-blur is costly. |
| **9. Marketability & Social Streamability** | **6.0 / 10** | Highly distinctive visual hook, but combat clips lack the visceral punch required for virality. |
| **10. Architectural Health & AI Extensibility**| **9.5 / 10** | Pristine zero-dependency TypeScript; 758 headless unit tests; immaculate logic/view separation. |
| **COMPOSITE ENTERTAINMENT INDEX** | **6.35 / 10** | *(Engineering Score: 9.5/10 — Pure Fun & Retention Factor: 5.2/10)* |

---

## 3. Systematic Breakdown: The Good vs. The Bad

### The Good
1. **The Tactical Autopilot Bridge:** Enabling the autopilot transforms the game from a stressful flight sim into an engaging tactical air-combat management game, opening the game to mobile and casual players.
2. **True Radar Terrain Masking:** Hugging mountain ridges to break missile locks is authentic military aviation modeled with pure vector mathematics.
3. **Procedural 3D Audio Telemetry:** Spatializing engine roars, sonic booms, and missile launch transients creates an immersive acoustic bubble with zero audio file downloads.
4. **Architectural Purity:** 758 headless tests, zero external dependencies, and strict deterministic state transitions make this codebase an engineer's dream.

### The Bad
1. **The Onboarding Ambush (Known Issue #32):** Teaching flight controls inside an active SAM kill zone guarantees early player churn.
2. **The "Passive Deck" Syndrome:** Deck turnaround offers almost no meaningful choices with tradeoffs. You click to rearm and wait.
3. **Absence of Emotional Stakes:** Infinite planes remove the fear of loss. Without persistent consequences, victories feel unearned.
4. **Sterile Destruction Feedback:** Destroying targets provides insufficient sensory gratification; vector models vanish instead of shattering.

---

## 4. Prioritized Actionable Roadmap

* **P0 (Critical for Retention):** Isolate Onboarding (Issue #32) into a safe, non-combat `TRAINING_SORTIE` with narrative radio chatter from a wingman ("Ghost-Lead"). Add a 5-second arcade time rewind.
* **P1 (High Impact - Game Feel):** Implement vector line fragmentation physics upon target destruction, camera-shake impulses, and a dynamic procedural synthwave bassline.
* **P2 (Strategic Depth & Progression):** Pivot into a persistent Rogue-lite Fleet Campaign with 24 finite airframes, fuel/ordnance logistics, and a node-based Norwegian Sea strategic map.

---

## 5. Directives & Master Prompts for Future AI Tasks

For copy-paste prompt templates to instruct AI agents on implementing these roadmap milestones, refer directly to [`docs/reviews/v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`](FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md).
