# Standardized Game Review & Evaluation Protocol

> **Purpose:** Authoritative evaluation framework for assessing new versions and major milestones (e.g., `v1.4.0`, `v2.0.0`) of **Carrier Vector: 1988**.  
> **Directory Convention:** Store evaluations in `docs/reviews/v<Version>/` (e.g., `docs/reviews/v1.4.0/COMPREHENSIVE_GAME_REVIEW.md`).  
> **Applicability:** Used by human game reviewers, QA leads, and autonomous AI agents.

---

## Review Metadata
* **Evaluated Version:** `vX.Y.Z`
* **Evaluation Date:** `YYYY-MM-DD`
* **Reviewer / Agent:** `[Human Name / AI Agent]`
* **Git Commit SHA:** `[Commit Hash]`
* **Deployment URL Tested:** `https://bejranonda.github.io/carrier-vector-1988/` (or local build)
* **Test Suite Status:** `[e.g., 758 tests passed / 0 failures]`
* **Hardware & Browsers Tested:** `[e.g., Desktop Chrome 128 (144Hz), Mobile Safari iOS 17.5]`

---

## 1. Multi-Dimensional Evaluation

### 1.1. Live Web Build & Session Telemetry
* **The First 60 Seconds:** What does a player see, hear, and feel immediately upon booting the game and launching off the catapult?
* **Pacing & Friction Points:** Where do delays occur? Is deck turnaround interactive or a dead waiting room?
* **Input Responsiveness:** Latency between input and control-surface response across keyboard, touch, and gamepad.

### 1.2. Source Code, Math Rigor & Architectural Health
* **Zero-Dependency Compliance:** Is runtime npm dependency count strictly zero? (No Three.js, gl-matrix, or physics engines).
* **Numerical Stability:** Fixed timestep (`FIXED_DT = 1/120s`) integrity, semi-implicit Euler integration, swept-volume collision detection.
* **Separation of Concerns:** Is pure simulation logic (aerodynamics, deck state, scoring) 100% decoupled from Canvas2D and Web Audio, enabling headless unit tests?

### 1.3. Narrative, Cold War Atmosphere & Flow
* **Atmospheric Immersion:** Does the 1988 North Atlantic Cold War premise resonate through visual styling, terminology, and audio?
* **Storytelling Delivery:** Is lore delivered through dynamic radio comms / wingman chatter, or dry briefing modals?
* **Mission Reactivity:** Are scenarios static configurations or dynamic event graphs (e.g., pop-up bogeys, scramble alerts, mid-mission updates)?

### 1.4. The Psychology of Fun & Kinetic "Game Feel" (Juice)
* **Kinetic Payoff:** Do destroyed targets shatter into physical vector debris line segments, or do they sterilely vanish?
* **Visceral Impact:** Presence of screen shake, camera recoil, CRT scanline tearing, and acoustic transients on cannon fire and missile hits.
* **Flow State Channel:** Does the difficulty curve keep the player between anxiety and boredom (Csíkszentmihályi's Flow)?

### 1.5. Player Churn Analysis, Mastery Curve & Retention
* **Drop-Off (Churn) Seconds:** At what exact timestamp is a newcomer most likely to close the browser tab? (e.g., Second 15 SAM strike).
* **Skill Floor vs. Skill Ceiling:** How steep is the learning curve between beginner survival and ace carrier traps?
* **Dopamine Cadence:** How many meaningful rewards or high-intensity micro-events occur per minute of play?
* **"One More Run" Factor:** What psychological hooks compel the player to restart after a mission failure or success?

### 1.6. Ergonomics, Cognitive Load & Accessibility
* **Ergonomics & Control Fatigue:** Key placement, finger travel, touch thumb positioning, and thumb occlusion over flight instruments.
* **Cognitive Load & HUD Clutter:** Can the player parse airspeed, altitude, AoA, and radar warnings under high-G defensive maneuvering?
* **Inclusive Accessibility:** Colorblind mode contrast compliance, photosensitive flash safety, and reduced-motion options.

### 1.7. Performance, Frame Pacing & Mobile Thermals
* **Refresh Rate Adaptability:** Consistency of physics and phosphor decay across 60Hz, 120Hz, and 144Hz monitors.
* **Draw Call & Canvas Budget:** Per-frame render duration (target: <8ms). Performance impact of shadows, bloom, and vector counts.
* **Garbage Collection (GC) Pressure:** Are vector objects, matrices, or telemetry strings allocated per frame causing GC stutter?
* **Mobile Thermal & Battery Drain:** Heat generation and battery consumption during prolonged sorties on mobile devices.

### 1.8. Marketability, Streamability & The "5-Second Hook"
* **Social Clip-Worthiness:** Can a 5–10 second gameplay snippet immediately captivate viewers on TikTok, YouTube Shorts, or X?
* **Visual Identity / USP:** What makes this game instantly recognizable compared to competitors (*Nuclear Option*, *Tiny Combat Arena*)?
* **Viral Sharing Mechanisms:** Effectiveness and readability of the Daily Sortie score share card.

### 1.9. AI-Maintainability & Autonomous Extensibility
* **AI Safe-Modification Index:** Can an autonomous LLM agent implement features without breaking physics or rendering invariants?
* **Headless Test Safety Net:** Percentage of codebase covered by automated headless tests.
* **Clarity of Documentation:** Do `GUIDELINES.md`, `APPROACH_AND_METHOD.md`, and `KNOWLEDGE.md` provide unambiguous formulas?

---

## 2. Standardized 10-Pillar Scoring Rubric

Compare current evaluation against the previous release baseline:

| Pillar | Previous (`vPrev`) | Current (`vCurr`) | Delta (Δ) | Evaluation Summary & Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **1. Flight Dynamics & Aerodynamics** | `/ 10` | `/ 10` | `+/-` | Aerodynamic depth, stall behavior, energy bleed, terrain masking. |
| **2. Carrier Deck Operations & Strategy** | `/ 10` | `/ 10` | `+/-` | Turnaround choices, resource trade-offs, deck crew management. |
| **3. UX, Controls & Ergonomics** | `/ 10` | `/ 10` | `+/-` | Autopilot assist, control schemes (Keyboard/Touch/Gamepad), ergonomics. |
| **4. Audio, CRT Aesthetics & Immersion** | `/ 10` | `/ 10` | `+/-` | Procedural Web Audio, spatialization, CRT bloom, retro styling. |
| **5. Visual "Game Feel" & Kinetic Juice** | `/ 10` | `/ 10` | `+/-` | Explosion debris physics, camera shake, visual hit feedback. |
| **6. Onboarding, Pacing & Cognitive Load** | `/ 10` | `/ 10` | `+/-` | Learning curve, tutorial design, non-lethal onboarding. |
| **7. Campaign Stakes & Replay Retention** | `/ 10` | `/ 10` | `+/-` | Persistent consequences, airframe loss, Rogue-lite map progression. |
| **8. Performance, Frame Pacing & Thermals**| `/ 10` | `/ 10` | `+/-` | Fixed timestep stability, Canvas2D efficiency, battery impact. |
| **9. Marketability & Social Streamability** | `/ 10` | `/ 10` | `+/-` | Viral clip appeal, visual hook, share card effectiveness. |
| **10. Architectural Health & AI Extensibility**| `/ 10` | `/ 10` | `+/-` | Zero-dependency compliance, headless tests, modular purity. |
| **COMPOSITE ENTERTAINMENT INDEX** | `/ 10` | `/ 10` | `+/-` | **Weighted holistic product score.** |

---

## 3. Systematic Breakdown: Improvements vs. Regressions

### What Improved in this Version
* *Improvement 1:*
* *Improvement 2:*

### What Remains Flawed or Regressed
* *Friction Point 1:*
* *Friction Point 2:*

---

## 4. Actionable Recommendations & Prioritized Roadmap
* **P0 (Critical for Player Retention):** Immediate fixes for high-churn bottlenecks.
* **P1 (High Impact - Game Feel & Audiovisuals):** Sensory upgrades and visceral juice.
* **P2 (Strategic Architecture & Campaign):** Core progression and system depth.

---

## 5. Directives & Master Prompts for Future AI Tasks
*(Include exact copy-paste prompts enforcing zero-dependency and mathematical guardrails for subsequent AI development iterations).*
