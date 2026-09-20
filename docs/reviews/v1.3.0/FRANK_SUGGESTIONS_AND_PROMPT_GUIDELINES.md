# Frank Suggestions, Creator Critique & AI Prompting Guidelines

> **Purpose:** This document speaks frankly to the project creator, cuts through developer biases, and provides exact prompt engineering directives for instructing future AI coding agents.

---

## 1. Frank Suggestions: The Unvarnished Truth

### 1.1. The "Engineer vs. Entertainer" Trap
As a developer, you take immense pride in technical rigor:
* *"Look at this hand-written 6-DOF aerodynamic matrix transformation!"*
* *"Look at this procedural Web Audio FM synthesis with zero MP3 samples!"*
* *"We have zero dependencies and zero Three.js bloat!"*

**Here is the harsh reality:** Players do not launch a game to admire your clean linear algebra or small bundle size. **Players play to feel like a fighter pilot.**

Right now, you have built an exceptional *aerodynamic laboratory*, but you have neglected the *entertainment machine*. When an enemy aircraft is destroyed, nothing happens except a wireframe deletion. There is no adrenaline rush, no screen-shaking explosion, no rewarding crunch. You must stop prioritizing mathematical purity over visceral player joy.

### 1.2. The "Checklist Mentality" Fallacy
Engineers love checklists; gamers hate them.
Presenting the player with an aviation checklist immediately after catapult launch—while enemy radar is acquiring lock—is a fundamental game design failure. It treats the player like an airline pilot taking an FAA certification exam rather than an action gamer strapping into an F-14.
* **Opposite View:** Delete the checklist. Introduce a fictional Wingman on the radio who guides the player conversationally. Never teach a player how to fly while missiles are actively tracking them.

### 1.3. The "Dual-Loop" Illusion
You market the game as a "Dual-Loop Flight Simulator & Carrier Deck Strategy Game."
* **The Reality:** It is not a dual-loop game. It is a flight simulator with an interactive loading screen.
* Clicking "Turnaround" and waiting for a progress bar is not strategy. Strategy requires **meaningful choices with tradeoffs** (e.g., *"Do I launch my last two fighters now to intercept incoming bombers, or hold them back to escort the fuel convoy?"*). Until decisions on the deck have long-term consequences, the deck loop is merely an interruption between flights.

---

## 2. Opposite Thinking: Challenging the Creator's Sacred Cows

| Creator's Sacred Assumption | The Opposite Truth / Critique | The Winning Compromise |
| :--- | :--- | :--- |
| *"Flight physics must be realistic down to the angle of attack and stall envelope."* | Realism often alienates 95% of players who simply want to dogfight. | Keep the pure 6-DOF physics under the hood, but make `AUTOPILOT` and `ASSIST` the default modes for new players. Celebrate tactical mastery over stick-and-rudder muscle memory. |
| *"Zero runtime dependencies means we cannot have rich explosions or dynamic music."* | Zero dependencies is an architectural constraint, not an excuse for sterile visuals. | Hand-roll vector fragmentation physics and procedural 80s synth basslines using Canvas2D and Web Audio. It is entirely possible to create Hollywood-grade "Juice" with pure math. |
| *"Each mission should be an independent, self-contained challenge."* | Isolated missions make every death meaningless and every victory forgettable. | A persistent Rogue-lite campaign binds sorties together. Losing an airframe must permanently hurt the fleet's fighting capacity. |

---

## 3. How to Improve Prompts & Instructions for AI Assistants

When you prompt AI models (Claude, Antigravity, or GPT) to work on this repository, you often get dry, mechanical code because your instructions ask for **features** rather than **game feel and behavioral feedback loops**.

### 3.1. The Three Prompting Golden Rules for This Repository
1. **Always Enforce the Architectural Boundaries:**  
   Remind the AI upfront: *"Zero runtime dependencies. Keep pure mathematical logic in `src/flight/` or `src/carrier/` and headless-testable via Vitest. Do not touch rendering or Canvas2D in physics classes."*
2. **Explicitly Request "Game Feel" / "Juice":**  
   If you tell an AI to *"add explosions"*, it will draw a simple circle. You must prompt for: *easing functions, velocity dispersal, lifetime alpha decay, screen shake impulses, and audio transients*.
3. **Specify the Emotional Arc:**  
   Tell the AI *how the player should feel*: *"The player should feel extreme urgency when painted by SAM radar. Accelerate the audio tempo, jitter the CRT scanlines, and flash directional HUD vectors."*

---

## 4. Copy-Paste AI Master Prompts for Upcoming Roadmap Features

Use these exact prompt templates when instructing an AI to develop the next phases:

### Template 1: Implementing Vector Fragmentation Explosions ("Juice")
```markdown
Agent, we are implementing kinetic "Game Feel" and visual juice for enemy destruction in `src/renderer/VectorRenderer.ts` and `src/flight/CombatSystem.ts`.

Requirements:
1. When any airborne target or ground SAM installation is destroyed, do not simply remove it. Break its 3D wireframe line segments into 10–16 individual line fragments.
2. In the simulation loop, apply parent momentum + outward radial explosion velocity (15–40 m/s) + random 3D angular tumble to each fragment.
3. Apply gravity and air drag to fragments so they arc toward the terrain/water.
4. Render them with decaying phosphor intensity over 1.2 seconds.
5. In `src/renderer/Camera.ts`, trigger a 150ms screen-shake impulse proportional to distance from the explosion.
6. Zero runtime dependencies. Maintain 120 FPS performance and write headless Vitest tests for the fragment physics state machine before touching Canvas2D.
```

---

### Template 2: Building the Rogue-lite Campaign State Machine
```markdown
Agent, review `docs/reviews/RECOMMENDATIONS_AND_ROADMAP.md` and `docs/APPROACH_AND_METHOD.md`. We are implementing the pure data structures for the persistent Rogue-lite Campaign in `src/campaign/CampaignState.ts`.

Requirements:
1. Define a persistent `FleetState` containing:
   - `airframes`: count of operational F-14 and A-6 aircraft (initial: 24 F-14, 12 A-6).
   - `ordnance`: inventory of AIM-9, AIM-7, GBU-12, and MK-82 weapons.
   - `fuelReserve`: total fleet JP-5 aviation fuel (litres).
   - `carrierHealth`: percentage from 100% to 0%.
2. Implement a node-based `CampaignMap` representing 7 interconnected sectors of the Norwegian Sea (Radar Outposts, Airfields, Surface Warships, Convoy Routes).
3. Implement deterministic state transition methods:
   - `recordSortieOutcome(result: SortieResult)`: Decrements airframes if lost in flight; consumes ordnance expended; applies carrier damage from unintercepted bombers.
   - `calculateSectorThreats(map: CampaignMap)`: Disabling an Early Warning Radar node reduces SAM detection range in adjacent sectors by 40%.
4. Zero UI/rendering code. This must be 100% pure TypeScript covered by comprehensive unit tests in `tests/campaign/CampaignState.test.ts`.
```

---

### Template 3: Creating the Isolated Narrative Onboarding Sortie
```markdown
Agent, resolve Known Issue #32 documented in `docs/KNOWN_ISSUES.md`. We are creating a non-lethal, narrative-guided onboarding mission in `src/core/Scenarios.ts`.

Requirements:
1. Create scenario `TRAINING_SORTIE` set in safe waters off Scotland.
2. Suppress all hostile SAM sites and enemy combat air patrols.
3. Replace the dry "Flight Checkout" checklist with a sequential radio event system (`src/flight/RadioComms.ts`).
4. Event triggers:
   - Catapult launch -> Ghost-Lead radio message: "Good launch, 201. Pull back gently to 2,500 ft."
   - Altitude reached -> "Engage Autopilot with [A]. She'll maintain wings-level flight."
   - Autopilot engaged -> "Arm Sidewinders with [W]. Target drone spawned at bearing 045."
   - Drone destroyed -> "Clean hit! Turn to 180 and prep for recovery trap."
5. Write headless tests verifying that the radio trigger sequence advances correctly based on aircraft telemetry state.
```
