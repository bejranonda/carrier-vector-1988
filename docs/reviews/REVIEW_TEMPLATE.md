# Game Review & Evaluation Template (Standardized Protocol)

> **Purpose:** Use this standardized template whenever conducting an evaluation of a new release or major milestone (e.g., `v1.4.0`, `v2.0.0`) of **Carrier Vector: 1988**.  
> **Directory Convention:** Save the resulting review in `docs/reviews/v<Version>/` (e.g., `docs/reviews/v1.4.0/COMPREHENSIVE_GAME_REVIEW.md`).

---

## Review Metadata
* **Evaluated Version:** `vX.Y.Z`
* **Evaluation Date:** `YYYY-MM-DD`
* **Reviewer / Agent:** `[Human / AI Agent Name]`
* **Git Commit SHA:** `[e.g., abc1234]`
* **Live Deployment Tested:** `https://bejranonda.github.io/carrier-vector-1988/`
* **Test Suite Status:** `[e.g., 758 tests passed / 0 failures]`

---

## 1. Multi-Dimensional Evaluation

### 1.1. Live Web Build & Real-World Playtest Telemetry
* *First 60 seconds experience: What does a player see, hear, and feel immediately upon launch?*
* *Onboarding & Tutorial Check: Does the tutorial conflict with active combat threats?*
* *Input feel: How responsive are keyboard, gamepad, and mobile touch controls?*
* *Pacing & Downtime: Does the carrier deck loop offer engaging decisions or boring downtime?*

### 1.2. Source Code, Math Engine & Architecture
* *Zero-Dependency Compliance: Did any external npm runtime packages creep in? (Must be strictly ZERO).*
* *Physics & Fixed-Timestep: Are aerodynamic equations and collision swept-volumes mathematically sound?*
* *Logic vs. View Decoupling: Can the core simulation and state transitions run headless in Vitest without Canvas2D/DOM?*
* *Scenario Engine Flexibility: Are missions hardcoded static configs or reactive event graphs?*

### 1.3. Concepts, Narrative, Atmosphere & Flow
* *Atmosphere & Setting: Does the 1988 Cold War aesthetic come alive in audio, text, and visual feedback?*
* *Narrative Delivery: Is the story told through dynamic radio chatter / wingman cues, or dry text modals?*
* *Mission Pacing: Are sortie objectives dynamic (mid-mission updates, unexpected threats, scramble alerts)?*

### 1.4. Entertainment Value, Dopamine Loops & "Game Feel" (Juice)
* *Kinetic Feedback: Do destroyed targets shatter into physical vector line fragments, or do they pop/vanish?*
* *Visceral Impact: Is there screen-shake, camera impulse, CRT scanline tearing, and acoustic crunch?*
* *Stakes & Consequences: Does losing an aircraft carry persistent weight across a campaign, or is it meaningless?*
* *Flow State Assessment: Does the difficulty curve maintain player flow, or swing between boredom and rage?*

---

## 2. Categorical Scoring & Version Delta

Compare scores directly against the previous version baseline:

| Dimension | Previous Version (`vPrev`) | Current Version (`vCurr`) | Delta (Δ) | Evaluation Summary & Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Flight Dynamics & Aerodynamics** | `/ 10` | `/ 10` | `+/-` | |
| **Cross-Platform UX & Controls** | `/ 10` | `/ 10` | `+/-` | |
| **Audio & CRT Aesthetic** | `/ 10` | `/ 10` | `+/-` | |
| **Visual "Game Feel" & Juice** | `/ 10` | `/ 10` | `+/-` | |
| **Onboarding & Tutorial** | `/ 10` | `/ 10` | `+/-` | |
| **Strategic Loop & Campaign Stakes** | `/ 10` | `/ 10` | `+/-` | |
| **OVERALL ENTERTAINMENT INDEX** | `/ 10` | `/ 10` | `+/-` | |

---

## 3. Systematic Breakdown: Improvements vs. Regressions

### What Improved in this Version
* *Feature / UX Polish 1:*
* *Feature / UX Polish 2:*

### What Remains Flawed or Regressed
* *Flaw / Unresolved Friction 1:*
* *Flaw / Unresolved Friction 2:*

---

## 4. Actionable Recommendations for Next Milestone
1. **P0 (Critical for Retention):**
2. **P1 (High Impact - Game Feel / Visuals):**
3. **P2 (Strategic / Long-term Architecture):**

---

## 5. Directives & Prompts for Future AI Implementation
*(Provide ready-to-use master prompt templates with clear mathematical boundaries and zero-dependency enforcement for the next AI agent).*
