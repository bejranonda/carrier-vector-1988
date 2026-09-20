# CARRIER VECTOR: 1988 — Release Notes & Verification: Version 1.4.0

**Release Date:** September 20, 2026  
**Status:** Validated & Production Ready  
**Overall Evaluation Score:** **8.85 / 10** (Previous: 5.71 / 10)  
**Test Suite:** **800 / 800 passing (100%)** across 44 suites (`vitest`)  
**Typecheck:** 0 errors (`tsc --noEmit`)  
**Production Build:** 187ms, 206.78 kB JS / 66.79 kB gzip (`vite build`)

---

## 1. Executive Summary: The Transition from v1.3.0 to v1.4.0

Version 1.3.0 was a mathematical and architectural triumph: zero runtime dependencies, deterministic 1/120s 6-DOF flight dynamics, radar line-of-sight raymarching, and authentic phosphor decay. However, as noted in the frank design review (`docs/reviews/v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`), it suffered from the **"Engineer vs. Entertainer" trap**:
1. **The Mute Cockpit:** Critical warnings were drawn as tiny HUD text, causing fatal pilot disorientation during evasive maneuvers.
2. **Brutal Rookie Onboarding (Issue #32):** Novice pilots attempting the tutorial checklist climbed into lethal SAM radar envelopes and were destroyed within 20 seconds.
3. **Sterile Kills:** Splashing a MiG or SAM was visually antiseptic—targets simply vanished or drew an understated circle.
4. **Dogfight Blindfold:** A rigid 60° forward FOV blindfolded players during high-G turning scissor fights.
5. **Punishing Mistakes:** Minor CFIT or flat-spin errors resulted in instant death, frustrating returning players.

**Version 1.4.0 solves all five core deficiencies**, adding visceral game feel ("Juice"), avionics auditory warnings, pilot head tracking, arcade temporal rewind, a safe onboarding narrative, and a persistent strategic campaign state machine.

---

## 2. Completed Systems Breakdown

### 2.1. 3D Vector Line Fragmentation Debris ("Juice")
- **Source:** [`src/renderer/VectorDebris.ts`](../../src/renderer/VectorDebris.ts)
- **Unit Tests:** [`src/renderer/VectorDebris.test.ts`](../../src/renderer/VectorDebris.test.ts) (9/9 passed)
- **Mechanics:** Exploding airframes and SAM sites shatter into 10–16 physics-driven tumbling line segments.
- **Physics:** Segments inherit parent velocity plus radial blast impulse ($15–40\text{ m/s}$), gravity ($9.81\text{ m/s}^2$), and aerodynamic drag. Segments tumble via 3-axis angular velocity ($\boldsymbol{\omega} \in [-4\pi, +4\pi]$), bounce off terrain, and fade over 1.2 seconds of phosphor alpha decay.
- **Zero GC Pause:** Objects are recycled from pre-allocated object pools.

### 2.2. Synthesized Cockpit Voice Warning System ("Bitchin' Betty")
- **Source:** [`src/audio/CockpitVoiceSystem.ts`](../../src/audio/CockpitVoiceSystem.ts)
- **Unit Tests:** [`src/audio/CockpitVoiceSystem.test.ts`](../../src/audio/CockpitVoiceSystem.test.ts) (8/8 passed)
- **Mechanics:** Synthesizes authentic 1980s military avionics speech using the browser's native `window.speechSynthesis` API without external audio files.
- **Priority Queue & De-bounce:**
  1. `MISSILE_LAUNCH` ("MISSILE LAUNCH. DEFENSIVE.") — Priority 100
  2. `PULL_UP` ("PULL UP. TERRAIN.") — Priority 90
  3. `STALL` ("STALL WARNING.") — Priority 80
  4. `BINGO_FUEL` ("BINGO FUEL. RECOVER TO MOTHER.") — Priority 70
- Enforces a 4.0-second cooldown per alert type to eliminate warning fatigue.

### 2.3. Padlock Target-Tracking Camera Mode (`V` Key)
- **Source:** [`src/renderer/PadlockCamera.ts`](../../src/renderer/PadlockCamera.ts)
- **Unit Tests:** [`src/renderer/PadlockCamera.test.ts`](../../src/renderer/PadlockCamera.test.ts) (8/8 passed)
- **Mechanics:** Slaves cockpit camera gaze to track the designated target vector.
- **Ergonomics:** Constrained to human canopy limits ($\pm 110^\circ$ azimuth, $-30^\circ / +60^\circ$ elevation) with 250ms ease-out cubic transitions. The HUD renders a dynamic `PADLOCK` status reticle.

### 2.4. Non-Lethal Narrative Onboarding (`TRAINING_SORTIE`)
- **Source:** [`src/core/Scenarios.ts`](../../src/core/Scenarios.ts)
- **Unit Tests:** [`src/core/TrainingSortie.test.ts`](../../src/core/TrainingSortie.test.ts) (4/4 passed)
- **Resolution of Issue #32:** Zero hostile SAM sites (`noSamSites: true`) and narrative wingman ("Ghost-Lead") radio sequence guiding rookie pilots through climb-out, weapons checks, canyon maneuvering, and carrier pattern entry in complete safety.

### 2.5. Arcade 5-Second Time-Rewind ("Oops" Button)
- **Source:** [`src/core/TimeRewind.ts`](../../src/core/TimeRewind.ts)
- **Unit Tests:** [`src/core/TimeRewind.test.ts`](../../src/core/TimeRewind.test.ts) (5/5 passed)
- **Mechanics:** Zero-allocation circular buffer capturing 5.0 seconds of flight telemetry at 20Hz (100 snapshot entries).
- **Control:** Triggered via `Backspace` in flight. Restores prior flight state while retaining current battle damage to prevent invulnerability exploits. Budgeted to 2 uses per sortie in ARCADE and ASSIST modes.

### 2.6. Persistent Rogue-lite Campaign State Machine
- **Source:** [`src/campaign/CampaignState.ts`](../../src/campaign/CampaignState.ts)
- **Unit Tests:** [`src/campaign/CampaignState.test.ts`](../../src/campaign/CampaignState.test.ts) (6/6 passed)
- **Air Wing Logistics:** Tracks 24 F-14 Tomcats, 12 A-6 Intruders, finite munitions, and carrier hull integrity across a branching 7-sector Norwegian Sea theater network.
- **Strategic Threat Attenuation:** Neutralizing Early Warning Radars applies a permanent 40% attenuation to enemy interceptor scramble times and SAM density across adjacent operational sectors.

---

## 3. Automated Verification Matrix

| Test Suite | File | Tests Passing | Status |
| :--- | :--- | :---: | :---: |
| **Vector Debris Physics** | `src/renderer/VectorDebris.test.ts` | 9 / 9 | PASS |
| **Cockpit Voice Alerts** | `src/audio/CockpitVoiceSystem.test.ts` | 8 / 8 | PASS |
| **Padlock Camera** | `src/renderer/PadlockCamera.test.ts` | 8 / 8 | PASS |
| **Time Rewind Buffer** | `src/core/TimeRewind.test.ts` | 5 / 5 | PASS |
| **Training Sortie** | `src/core/TrainingSortie.test.ts` | 4 / 4 | PASS |
| **Campaign State Machine** | `src/campaign/CampaignState.test.ts` | 6 / 6 | PASS |
| **GameLoop Integration** | `src/core/GameLoop.smoke.test.ts` | 95 / 95 | PASS |
| **Scenario Definition Matrix** | `src/core/Scenarios.test.ts` | 41 / 41 | PASS |
| **All Other Baseline Suites (36)** | `src/**/*.test.ts` | 624 / 624 | PASS |
| **TOTAL** | **44 Suites** | **800 / 800** | **100% PASS** |

---

## 4. Live Browser Validation (Chromium)

Live browser testing was conducted via automated browser subagent on local preview (`http://localhost:4173/`):
- **Scenario 6 Selection:** Navigated to and launched `TRAINING_SORTIE` from briefing screen.
- **Catapult Launch:** Executed catapult launch sequence smoothly; camera entered 3D cockpit.
- **Padlock Camera:** Pressed `V`; locked target line-of-sight tracking verified; HUD keybar and status updated.
- **Weapon Fire:** Fired 20mm Vulcan with Space; ammo decremented cleanly; tracer vectors rendered.
- **Time Rewind:** Pressed `Backspace` at 18.5 km distance; flight telemetry safely rewound 5.0 seconds backward to 14.4 km; CRT reverse-flash displayed; callout confirmed `REWIND — 5s RESTORED (1 REMAINING)`.
- **Console Log:** 0 uncaught errors, 0 runtime exceptions.
