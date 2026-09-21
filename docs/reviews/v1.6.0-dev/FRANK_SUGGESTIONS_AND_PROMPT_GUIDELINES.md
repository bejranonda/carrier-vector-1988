# Frank Suggestions, Opposite Thinking & AI Master Prompts (v1.6.0-dev)

> **Philosophy:** A true pair programmer does not merely praise your code; they tell you when your design is hurting your players.
> This document contains candid critiques, opposite-thinking analyses, prompt improvements, and copy-paste AI master prompts.

---

## 1. Frank Blame & Constructive Critique

### 1.1. The "Engineer's Ivory Tower" Trap
The codebase is an extraordinary display of mathematical prowess: fixed-timestep Euler integration, dynamic pressure scaling, swept-sphere proximity fuzing, and pure Canvas2D vector pipelines with zero runtime dependencies.

**However, you fell into the classic simulator trap:**
* You wrote mathematically pure decoupled Euler equations (`pitch`, `roll`, `yaw`) and congratulated yourself on writing 6-DOF physics.
* But you forgot to check if the jet **actually flies like a jet**! In an actual airplane, banking directs the wing's lift sideways and turns the plane. By leaving yaw exclusively on rudder keys (`Q`/`E`), you built an airplane that rolls like a spinning tube while flying straight like a train on tracks!
* **A game is not an aerospace paper.** A game is an **entertainment machine** designed to deliver joy, agency, and dopamine. If a player presses Left Arrow and the plane doesn't turn, all the zero-dependency linear algebra in the world doesn't matter: the player closes the tab.

### 1.2. Don't Confuse Military Jargon with Good Game UX
* Calling the bottom-right display `"RWR"` and drawing `S`, `T`, `M`, and `X` is authentic to an F-14 or F/A-18 NATOPS manual.
* But in a video game, **nobody knows what an RWR is**! Players expect a **RADAR / MINIMAP**. They want to know: *Where is the carrier? Where is the enemy? Where do I fly?*
* By withholding that information in the name of realism, you didn't create depth; you created blindness and frustration.

### 1.3. Stop Dumping Players onto the Deck Without Explaining Death
* When a rookie takes damage and dies, snapping the camera instantly to the 2D deck management screen feels like a software crash or an accidental keypress.
* Players need **dramatic closure**. Show the plane explosion, shake the screen, let the radio scream *"Mayday!"*, and display a bold, clear obituary banner: *"Shot down by MiG-23 cannon fire astern"*. Give the player 3 seconds to process the loss.

---

## 2. Opposite Thinking: Challenging Common Simulator Assumptions

| Conventional Simulator Instinct | The Opposite Reality (Player-Centric Design) |
| :--- | :--- |
| *"A flight simulator must decouple ailerons and rudder pedals for realism."* | **False.** 99% of arcade and semi-sim players fly with arrow keys, WASD, or gamepad sticks. Rolling **must** automatically induce aerodynamic turn rate ($\dot{\psi} \propto \tan\phi$). Rudder should be an optional fine-trim tool for gunnery, not the only way to turn the nose. |
| *"More gauges and telemetry make the game look professional and realistic."* | **False.** A screen cluttered with 22 dials causes cognitive paralysis. The best retro combat games (*Ace Combat 04*, *Wing Commander*, *Star Wars Arcade*) display only **Speed, Altitude, Target Reticle, and Radar**. Everything else is noise. |
| *"Players should read the briefing and memorize hotkeys before taking off."* | **False.** Modern players do not read 40-key manuals. If a mechanic is not prompted dynamically on-screen at the exact second it is needed, it effectively does not exist. |
| *"A narrow fjord canyon forces exciting high-stakes flying."* | **False.** A 500-metre straight trench with 1800-metre vertical walls is a bowling alley, not a dogfight arena. Give players branching fjords, sea-level archipelagos, and open sky so they can manoeuvre. |

---

## 3. How to Improve Your Prompts and Instructions

When directing AI agents to develop games, avoid prompts that over-emphasize engineering constraints over play feel.

### What went wrong in previous prompts:
* Asking for "zero dependencies", "rigorous linear algebra", and "headless unit tests" produced an incredible engineering architecture that passed 870+ tests while being almost unplayable for a human beginner.
* The prompt asked for "realism" without specifying **"game feel"** or **"time-to-fun"**.

### Recommended Prompting Principles for Future Versions:
1. **Always lead with the Player Fantasy:**  
   *Example:* "I want the player to feel like an ace fighter pilot screaming through Arctic canyons, easily turning into bandits and blowing them out of the sky with Sidewinders."
2. **Specify the Primary Verb and Feedback Loop:**  
   *Example:* "When the player presses Left Arrow, the aircraft must bank $45^\circ$ and immediately carve a fast, satisfying left turn across the landscape."
3. **Mandate Progressive Disclosure:**  
   *Example:* "Do not show veteran sim gauges by default. Start with a clean Arcade HUD with a prominent contextual hint box at the bottom."

---

## 4. AI Master Prompts for Immediate Implementation

Copy and paste these exact prompts to guide the next AI development task:

### Prompt 1: Implement Coordinated Bank-to-Turn Aerodynamics & Loop Pitch Authority (Tier 0)
```markdown
You are a senior flight dynamics engineer and game designer.
Please fix the critical flight steering defect in `src/flight/AircraftPhysics.ts`:

1. Couple bank angle (`this.roll`) directly into horizontal yaw rate (`this.yaw`) in `AircraftPhysics.update(dt)`.
   - Formula: `turnRate = (GRAVITY * Math.tan(this.roll) / Math.max(30, this.airSpeed)) * this.controlAuthority`
   - When the aircraft banks, the nose must swing smoothly in the direction of the bank.
2. Remove the artificial pitch clamp at 88 degrees (`maxPitch = 88 * Math.PI / 180`).
   - Allow full 360-degree vertical loop authority (inside loops, Immelmann turns, Split-S).
3. Ensure all existing 874 tests pass and add unit tests verifying:
   - Rolling left produces negative yaw rate (left turn).
   - Pitching up can pass vertical without sticking.
Keep zero runtime dependencies and ensure 100% headless test stability.
```

### Prompt 2: Tactical Radar & Dynamic Rookie Copilot HUD Guidance (Tier 1)
```markdown
You are an expert game UX designer and Canvas2D rendering engineer.
Please upgrade the cockpit HUD in `src/renderer/HUD.ts`:

1. Transform the bottom-right circular scope from an arcane RWR into an Integrated Tactical Radar / Minimap:
   - Display carrier position (white icon with bearing line and distance in NM).
   - Display airborne bandits as directional red triangles.
   - Display active waypoint as a yellow diamond.
   - Keep SAM radar lock alerts as a pulsing outer threat strobe.
2. Add a dynamic "Rookie Copilot" contextual guidance banner at bottom-center:
   - Prompt `[T] TO LOCK BANDIT` when enemy is in forward sector.
   - Prompt `[SPACE] TO FIRE` when target is locked in range.
   - Prompt `[X] DEPLOY CHAFF` when a missile launch warning occurs.
   - Prompt `[L] FOR CARRIER APPROACH` when mission objectives are complete.
Ensure zero regressions across the Vitest suite and clean responsive layout.
```
