# Frank Suggestions, Creator Critique & Prompt Engineering Mastery

> **Purpose:** This document speaks directly and unvarnished to the project creator, deconstructs developer biases, critiques the user's prompting techniques, and provides master prompt templates for directing AI assistants.

---

## 1. Frank Suggestions: The Unvarnished Truth & Blaming the Creator

### 1.1. The "Engineer vs. Entertainer" Trap
As a developer, you take immense pride in technical rigor:
* *"Look at our hand-written 6-DOF aerodynamic matrix transformation!"*
* *"Look at our zero-dependency procedural Web Audio FM synthesis!"*
* *"We have zero Three.js bloat and clean linear algebra!"*

**Here is the frank truth:** Players do not launch a game to admire your clean linear algebra or your small bundle size. **Players launch a game to feel like a fighter pilot.**

You built an exceptional *aerodynamic laboratory*, but you neglected the *entertainment machine*. When an enemy aircraft is destroyed, nothing happens except a wireframe deletion. There is no adrenaline rush, no screen-shaking explosion, and no rewarding crunch. You prioritized mathematical purity over visceral player joy.

### 1.2. The "Mute Cockpit" Blindspot
Fighter jets are terrifyingly loud, sensory-overloaded machines. Yet in *Carrier Vector: 1988*, the cockpit is completely **mute**. There is no voice warning system, no wingman dialogue, and no radio brevity codes. 
* By omitting voice warnings (*"PULL UP"*, *"WARNING: MISSILE LAUNCH"*, *"STALL"*), you forced the player to divide their visual attention between aiming through the HUD and reading tiny warning text at the bottom of the screen. In a supersonic dogfight, that visual split causes instant death.

### 1.3. Tunnel-Vision Boresight
You gave the player a fixed 60° forward field of view with no way to look around. In combat aviation, *"Lose sight, lose the fight"*. Forcing the player to dogfight with blinders on turns every turning engagement into an exercise in staring at the 2D radar screen rather than tracking the bandit visually through the canopy.

### 1.4. The "Checklist Mentality" Fallacy
Engineers love checklists; gamers hate them.
Presenting the player with an aviation checklist immediately after catapult launch—while enemy radar is acquiring lock—is a fundamental design flaw. It treats the player like a student taking a written FAA pilot exam rather than an action gamer strapping into a high-performance jet.
* **Opposite View:** Delete the checklist. Introduce a fictional Wingman on the radio who guides the player conversationally. Never teach a player how to fly while missiles are actively tracking them.

---

## 2. Opposite Thinking: Challenging the Creator's Sacred Assumptions

| Creator's Sacred Assumption | The Opposite Truth / Critique | The Winning Compromise |
| :--- | :--- | :--- |
| *"Flight physics must be realistic down to the angle of attack and stall envelope."* | Purist realism alienates 95% of players who simply want to dogfight. | Keep pure 6-DOF physics under the hood, but make `AUTOPILOT` and `ASSIST` the default modes for new players. Celebrate tactical mastery over stick-and-rudder muscle memory. |
| *"Zero runtime dependencies means we cannot have voice warnings or rich explosions."* | Zero dependencies is an architectural constraint, not an excuse for sterile presentation. | Hand-roll vector fragmentation physics, use the browser's native Web Speech API (`window.speechSynthesis`), and synthesize procedural 80s basslines in Web Audio. Hollywood-grade "Juice" can be built with pure math. |
| *"Each mission should be an independent, self-contained challenge."* | Isolated missions make every death meaningless and every victory forgettable. | A persistent Rogue-lite campaign binds sorties together. Losing an airframe must permanently hurt the fleet's fighting capacity. |

---

## 3. Critiquing & Improving Your AI Prompts and Commands

You asked: *"You can also suggest to improve this prompts, command and instruction here."*

Here is an honest critique of your current prompting style and how to improve it to get maximum productivity out of AI coding agents:

### 3.1. What Was Inefficient in Your Previous Prompts
1. **Verbatim Re-pasting:**  
   In this session, you pasted the exact same prompt multiple times in sequence. When an AI receives an identical large prompt repeatedly, it may re-run previous research or hesitate between re-answering or executing code, leading to wasted context tokens.
2. **Mixing Evaluation with Execution:**  
   Prompting *"Review this game and give comment... Record this as documents here... These documents will be applied to improve the game later"* bundles a critical design review with file architecture operations.
3. **Implicit Workflows:**  
   AI models execute best when the instruction specifies: **Role → Context → Desired Output Format → Verification Criteria**.

### 3.2. The Golden AI Prompt Formula for Game Development
When instructing AI agents (Claude, Antigravity, GPT) on this repository, structure your prompts into **4 Distinct Blocks**:

```markdown
1. CONTEXT & GUARDRAILS:
   "Review docs/GUIDELINES.md and docs/APPROACH_AND_METHOD.md. Remember: zero runtime dependencies, fixed-timestep 1/120s, pure logic decoupled from Canvas2D."

2. THE SPECIFIC TASK:
   "Implement [Feature Name] in [Exact File Paths]."

3. GAME FEEL & BEHAVIOR:
   "Do not just write basic logic. Focus on player psychology and 'Game Feel': include easing functions, audio transients, and visual feedback."

4. VERIFICATION & TESTS:
   "Write comprehensive headless Vitest unit tests in tests/[Feature].test.ts. Ensure all tests pass before making visual changes."
```

---

## 4. Copy-Paste AI Master Prompts for Roadmap Features

Use these exact copy-paste prompt templates to instruct an AI assistant to implement the new roadmap features:

### Template 1: Vector Line Fragmentation Explosions ("Juice")
```markdown
Agent, we are implementing kinetic "Game Feel" and visual juice for target destruction in `src/renderer/VectorRenderer.ts` and `src/flight/CombatSystem.ts`.

Requirements:
1. When an airborne aircraft or ground SAM site is destroyed, do not simply delete the wireframe. Decompose its 3D wireframe line segments into 10–16 individual line debris objects.
2. In the simulation loop, apply parent momentum + outward radial explosion velocity (15–40 m/s) + random 3D angular rotation to each line fragment.
3. Apply gravity and air drag to fragments so they arc toward the water/terrain.
4. Render them with decaying phosphor alpha over 1.2 seconds.
5. In `src/renderer/Camera.ts`, trigger a 150ms screen-shake impulse proportional to distance.
6. Zero runtime dependencies. Maintain 120 FPS performance and write headless Vitest tests in `src/renderer/VectorDebris.test.ts` verifying fragment state transitions before touching Canvas2D.
```

---

### Template 2: Synthesized Cockpit Voice Warnings ("Bitchin' Betty")
```markdown
Agent, implement a synthesized Cockpit Voice Warning System ("Bitchin' Betty") in `src/audio/CockpitVoiceSystem.ts` and wire it into `src/core/GameLoop.ts`.

Requirements:
1. Zero runtime npm dependencies. Use either native Web Speech API (`window.speechSynthesis`) or procedural phonetic audio synthesis in `src/audio/WebAudioSystem.ts`.
2. Voice profile: Monotone, robotic, crisp 1980s military synthesized voice.
3. Trigger conditions with priority queue and de-bounce cooldowns (do not repeat within 4 seconds):
   - Priority 1: "WARNING: MISSILE LAUNCH" (Hostile SAM guidance radar lock active).
   - Priority 2: "PULL UP, PULL UP" (Altitude < 200m and vertical speed < -30 m/s).
   - Priority 3: "STALL, STALL" (|α| > 18° and control authority reduced).
   - Priority 4: "BINGO FUEL" (Fuel capacity < 15%).
4. Respect reduced-motion and accessibility toggles: allow muting voice alerts in the settings menu.
5. Write headless unit tests verifying priority queuing and cooldown timers in `src/audio/CockpitVoiceSystem.test.ts`.
```

---

### Template 3: Padlock Target-Tracking Camera Mode (`V` Key)
```markdown
Agent, implement a "Padlock" target-tracking camera mode in `src/renderer/Camera.ts` and bind it to key `V` (with touch button support).

Requirements:
1. When the player holds or toggles key `V` and has a designated target (`designatedTarget !== null`):
   - Smoothly interpolate the camera look-at orientation vector from the aircraft boresight toward the target position in 3D world space.
   - Maintain the aircraft physics coordinate system unchanged; only the visual projection camera rotates.
   - Clamp the camera look angle to a realistic human canopy limit (max 110° azimuth, 60° elevation).
2. When releasing `V` or if the target is lost/destroyed, smoothly interpolate camera back to cockpit boresight over 250ms with ease-out cubic interpolation.
3. Write headless unit tests validating angle clamping and interpolation math in `src/renderer/PadlockCamera.test.ts`.
```

---

### Template 4: Non-Lethal Narrative Onboarding (`TRAINING_SORTIE`)
```markdown
Agent, resolve Known Issue #32 documented in `docs/KNOWN_ISSUES.md`. We are replacing the hostile checklist onboarding with a guided narrative training mission in `src/core/Scenarios.ts`.

Requirements:
1. Create scenario `TRAINING_SORTIE` set in peaceful waters off Scotland.
2. Completely suppress hostile SAM sites, radar emitters, and enemy combat air patrols.
3. Replace the dry "Flight Checkout" checklist with a sequential radio event system (`src/flight/RadioComms.ts`).
4. Event triggers:
   - Catapult launch -> Ghost-Lead radio message: "Good launch, 201. Pull back gently to 2,500 ft."
   - Altitude reached -> "Engage Autopilot with [A]. She'll maintain wings-level flight."
   - Autopilot engaged -> "Arm Sidewinders with [W]. Target drone spawned at bearing 045."
   - Drone destroyed -> "Clean hit! Turn to 180 and prep for recovery trap."
5. Write headless unit tests verifying that the radio trigger sequence advances correctly based on aircraft telemetry state in `src/core/TrainingSortie.test.ts`.
```

---

### Template 5: Persistent Rogue-lite Campaign State Machine
```markdown
Agent, review `docs/reviews/v1.3.0/RECOMMENDATIONS_AND_ROADMAP.md` and `docs/APPROACH_AND_METHOD.md`. We are implementing the pure data structures for the persistent Rogue-lite Campaign in `src/campaign/CampaignState.ts`.

Requirements:
1. Define a persistent `FleetState` containing:
   - `airframes`: operational F-14 Tomcat and A-6 Intruder counts (initial: 24 F-14, 12 A-6).
   - `ordnance`: inventory of AIM-9, AIM-7, GBU-12, and MK-82 weapons.
   - `fuelReserve`: total fleet JP-5 aviation fuel (litres).
   - `carrierHealth`: percentage from 100% to 0%.
2. Implement a node-based `CampaignMap` representing 7 interconnected sectors of the Norwegian Sea.
3. Implement deterministic state transition methods:
   - `recordSortieOutcome(result: SortieResult)`: Decrements airframes if lost in flight; consumes ordnance expended; applies carrier damage from unintercepted bombers.
   - `calculateSectorThreats(map: CampaignMap)`: Disabling an Early Warning Radar node reduces SAM detection range in adjacent sectors by 40%.
4. Zero UI/rendering code. This must be 100% pure TypeScript covered by comprehensive unit tests in `src/campaign/CampaignState.test.ts`.
```
