# Carrier Vector 1988: Reconsideration & Entertainment Audit (v1.7.0)

## Review Metadata
* **Evaluated Version:** `v1.7.0`
* **Evaluation Date:** `2026-09-21`
* **Focus Dimension:** Entertainment Value, Beginner Onboarding & Cognitive Load Balance
* **Git Status:** Clean tree (at commit `v1.7.0`)
* **Reference URL:** https://bejranonda.github.io/carrier-vector-1988/

---

## 0. Player Evidence (Mandatory First Step)

> *"In the v1.5.0-dev review, three verbatim sentences from one human playtester identified more real defects than the entire preceding review suite. Code reading finds what is; players find what hurts."*

### Verbatim Confusions:
1. *"As beginner, I feel there are a lot of info on the screen, I do not know what to do and to start!"*
2. *"It is hard to understand how to control the game and the jet."*
3. *"Please find the balance of complexity and entertainment. Please make the game to entertain the player, not give difficult tasks for new player."*

### Honest Diagnosis:

| # | Player Said | Misunderstanding or Missing Feature? | Code Evidence (`file:line`) |
|---|-------------|---------------------------------------|------------------------------|
| **1** | *"A lot of info on the screen, I do not know what to do and to start!"* | **Missing Feature / Flawed Default Routing.** The game actually contains a gentle, guided `TRAINING_SORTIE` scenario with step-by-step checklists, but `GameLoop.ts` hardcodes `DEFAULT_SCENARIO = 'CARRIER_DEFENSE'`. When a new player launches, they are thrown directly into an escalating 4-wave combat air patrol with supersonic bombers and live SAM batteries instead of the tutorial. | [GameLoop.ts:233](file:///d:/Git/Werapol/Game/Flight/src/core/GameLoop.ts#L233)<br>[Scenarios.ts:699](file:///d:/Git/Werapol/Game/Flight/src/core/Scenarios.ts#L699) |
| **2** | *"It is hard to understand how to control the game and the jet."* | **Missing Feature & Feedback Deficit.** 35+ keys in `CONTROL_SCHEMA`. In `ASSIST` mode, throttle is still fully manual, so beginners stall by neglecting throttle. When they stall, the controls lock up (control authority drops to 22%), and upon crashing the post-mortem erroneously advises them to *"Pull up"*—which causes immediate re-stalling. | [AircraftPhysics.ts:329](file:///d:/Git/Werapol/Game/Flight/src/flight/AircraftPhysics.ts#L329)<br>[PostMortem.ts:48](file:///d:/Git/Werapol/Game/Flight/src/core/PostMortem.ts#L48) |
| **3** | *"Please find the balance of complexity and entertainment... entertain the player, not give difficult tasks."* | **Architectural Imbalance.** The game engine models aerospace equations (induced drag, dynamic alpha, thermal signatures, radar RCS) with 10/10 fidelity, but dedicates almost zero feedback to player dopamine: kills give an imperceptible 1% camera shake, targets are not auto-locked, and HUD `ARCADE` mode still displays dense engineering gauges. | [CameraShake.ts:56](file:///d:/Git/Werapol/Game/Flight/src/renderer/CameraShake.ts#L56)<br>[TargetDesignation.ts:86](file:///d:/Git/Werapol/Game/Flight/src/tactics/TargetDesignation.ts#L86)<br>[HUD.ts:797](file:///d:/Git/Werapol/Game/Flight/src/renderer/HUD.ts#L797) |

---

## 1. Deep-Dive Reconsideration: What Else to Improve

### 1.1 The "First-Launch" Trap: Why New Players Feel Lost
In `src/core/Scenarios.ts`, the developer created an excellent function:
```ts
export function recommendScenario(records: MissionRecords): ScenarioDef {
    const neverFlown = SCENARIOS.every(s => recordFor(records, s.id).attempts === 0);
    const firstFlight = SCENARIOS.find(s => s.setup.isFirstFlight);
    if (neverFlown && firstFlight) return firstFlight;
    ...
}
```
`TRAINING_SORTIE` is marked `isFirstFlight: true`. It features Ghost-Lead voice callouts, a gentle climb to 2,500 ft, autopilot check, shooting an unarmed drone, and carrier recovery.

**The Bug/Flaw:**
In `src/core/GameLoop.ts`, initialization completely ignores `recommendScenario`:
```ts
public scenario: ScenarioDef = scenarioById(DEFAULT_SCENARIO); // 'CARRIER_DEFENSE'
```
A beginner opening the website sees `CARRIER_DEFENSE` preselected, hits ENTER, and finds themselves on the catapult facing multi-axis missile strikes. They don't know how to fly, so they crash in 20 seconds.
**Improvement:** Initialize `this.scenario = recommendScenario(this.missionRecords)` on game start. First-time visitors must be guided to `TRAINING_SORTIE` by default.

---

### 1.2 The "Blind Hunter" Problem: No Automatic Target Acquisition
In vector graphics, discerning a 12-pixel enemy fighter against wireframe mountains is nearly impossible without HUD symbology.
- Currently, targets are only designated if the player manually presses `T` (or clicks an enemy on desktop).
- If a beginner does not press `T`:
  1. The Sidewinder missile seeker is unslaved and has a narrow 30° cone.
  2. There is no lead-computing gun pipper.
  3. The off-screen directional chevron is absent, so the player has no idea where enemies are relative to their heading.
  4. Crucially, when `assistLevel === 'AUTO'`, the Autopilot doesn't know what to intercept and simply flies straight ahead at 240 m/s into empty space!
**Improvement:**
- When airborne in `AUTO` or `ASSIST` mode (or whenever no target is locked), automatically acquire and designate the highest-threat airborne contact!
- The player immediately gets a direction arrow to turn toward the fight, the Autopilot automatically routes toward the target, and Sidewinders lock instantly.

---

### 1.3 Lethal Post-Mortem Advice: Diagnosing Stalls as Terrain Crashes
When a beginner pulls back hard on the stick:
1. Angle of attack (AoA) exceeds 18°.
2. `isStalled` flips to `true`, and control authority drops to 0.22.
3. The jet stalls, enters a descent, and strikes the water or terrain.
4. `GameLoop.ts` logs:
   ```ts
   this.lastLossCause = { kind: 'TERRAIN', detail: 'terrain' };
   ```
5. `PostMortem.ts` shows:
   ```ts
   'Watch altitude AGL below 300 m - pull up before the ridge fills the windscreen, not after.'
   ```
This is disastrous for a learner. Telling a stalled player to "pull up" causes them to pull up even harder on their next run, immediately stalling again!
**Improvement:**
- Track `STALL` as an explicit `LossCauseKind`. If the aircraft was stalled prior to impact, diagnose:
  - `LOST TO AERODYNAMIC STALL / SPIN`
  - Advice: `STALL OCCURRED: Push nose DOWN [S] and advance throttle [SHIFT] to regain airflow before pulling up!`
- If `this.physics.fuel <= 0`, diagnose `LOST TO FUEL EXHAUSTION`.
- If impacting sea level (`elevation <= 4`), report `DITCHED IN OCEAN` instead of `LOST IN CANYON`.

---

### 1.4 The "Juice" Deficit: Combat Lacks Visceral Feedback
In classic retro-arcade games (e.g., *Wing Commander*, *After Burner*, *Ace Combat*), destroying an enemy is a moment of pure dopamine:
- Currently in `CameraShake.ts`:
  ```ts
  killConfirmed: 0.10 // 0.10^2 = 0.01 amplitude displacement
  ```
  The screen barely vibrates when a 15-ton bomber detonates.
- The flash is a subtle 0.12s blip.
- Debris fragments are capped at 14 pieces.
- There is no center-screen kill announcement (only a small text entry in the log).
**Improvement:**
- Increase `killConfirmed` trauma from `0.10` to `0.35`–`0.45` so every kill rattles the canopy with satisfying weight.
- Spawn 24–32 debris fragments with higher burst velocity.
- Render a bold, arcade-style center HUD kill confirmation: `★ SPLASH ONE (MiG-23) ★`.

---

### 1.5 Decluttering the ARCADE HUD: Cognitive Load Reduction
The user explicitly stated:
*"As beginner, I feel there are a lot of info on the screen, I do not know what to do and to start!"*

Even in `ARCADE` HUD mode:
- The player is shown speed, altitude, pitch ladder, compass tape, throttle detent, fuel in exact liters (`4321 L`), G-load (`2.4G`), bay status, RWR, objective strip, assist annunciator, and key bar.
- For a beginner, reading numbers like `4500 L` or `3.2 G` while trying to avoid a mountain induces cognitive paralysis.
**Improvement:**
- In `ARCADE` mode, replace granular engineering units with clear, visual bars:
  - Simple Fuel Bar (Green -> Amber -> Red).
  - Prominent Hull / Shield Bar (100% -> 0%).
  - Highlight the one current action needed (e.g., `FIRE MISSILE [SPACE]` or `TURN RIGHT TO TARGET ➔`).
  - Hide non-essential indicators like exact G-force and weapons bay doors when closed.

---

### 1.6 Cruising Auto-Throttle Assist for Beginners
Many beginners crash because they don't realize their engine is idling at 0% or because they forget to manage throttle while steering.
- In `ARCADE` pacing or with `ASSIST` enabled, implement a baseline cruise floor:
  - If throttle is at 0 and airspeed drops below 160 m/s, automatically apply gentle military power (60%) to prevent uncommanded stalls.
  - Full manual control remains available whenever the player presses `CTRL` or `SHIFT`.

---

## 2. Prioritized Action Roadmap

| Priority | Action Item | Target Files | Impact on Fun / Beginner Experience |
|:---:|---|---|---|
| **P0** | **Default to Training Sortie for New Players** | `GameLoop.ts`, `Scenarios.ts` | **Massive.** Stops throwing beginners into a lethal 4-wave air raid on first click. |
| **P0** | **Automatic Target Acquisition** | `TargetDesignation.ts`, `GameLoop.ts` | **Massive.** Guides the player straight to enemies, enables Autopilot intercept, and slaves missiles. |
| **P1** | **Accurate Stall / Ocean Post-Mortem Tips** | `PostMortem.ts`, `GameLoop.ts` | **High.** Teaches beginners how to actually recover from stalls instead of giving lethal "pull up" advice. |
| **P1** | **Visceral Kill Impact & Combat Juice** | `CameraShake.ts`, `GameLoop.ts`, `HUD.ts` | **High.** Dramatic screen rumble, bright kill banners, and explosive vector debris make combat deeply rewarding. |
| **P2** | **ARCADE HUD Streamlining** | `HUD.ts`, `HudLayout.ts` | **High.** Cuts visual clutter by 50% for beginners, focusing eyes on the objective and crosshairs. |
| **P2** | **Low-Speed Anti-Stall Auto-Throttle** | `AircraftPhysics.ts`, `FlightAssist.ts` | **Medium.** Prevents beginners from stalling out of the sky due to forgotten throttle management. |

---

## 3. Conclusion
Carrier Vector 1988 has already mastered the science of flight simulation. To win over the player as an **entertainment and fun maker**, it must now master the art of player psychology: **guide first, assist effortlessly, and reward every triumph with maximum impact.**
