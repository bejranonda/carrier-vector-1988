# Frank Suggestions, Creator Critique & AI Master Prompts (v1.4.0)

> **Purpose:** Direct, unvarnished critique of developer biases, honest analysis of player psychology, deconstruction of prompting habits, and production-ready master prompts for directing autonomous AI agents.

---

## 1. Frank Suggestions: The Unvarnished Truth & Blaming the Creator

You asked to be spoken to frankly, to be blamed honestly, and to hear opposite perspectives. Here is the unvarnished truth about where *Carrier Vector: 1988* stands today:

### 1.1. The "Engineer's Arrogance": Forgetting the Player
You have built one of the cleanest, most mathematically rigorous zero-dependency flight physics engines on the web. 800 passing tests. Zero runtime npm dependencies. Fixed-timestep 120Hz semi-implicit Euler integration.

**And yet, you built an onboarding experience so hostile that a first-time player feels stupid within 20 seconds.**

Here is the blunt reality: **Players do not launch a web game to pass an FAA aeronautical exam.** They launch a game to experience the thrill of being a fighter pilot. When you cover their screen with 22 simultaneous readouts, force them to read a six-step flight checklist, and allow supersonic SA-6 missiles to obliterate them while they are searching for the throttle key, you are not creating a "hardcore challenge"—you are inflicting bad design.

### 1.2. The Desktop Mouse Blindspot: Developer Condescension
In `src/main.ts`, line 259, you wrote:
> *"Deliberately NOT wired into the deck or the cockpit, where a stray click must never fire a catapult."*

This is the quintessential **"Developer Knows Best" fallacy**. 
You decided that because a stray click *might* launch a plane prematurely, desktop players should be forbidden from using their mouse entirely!
On desktop web, the mouse is the user's primary limb. When a user sees buttons on screen and clicks them with zero response, they do not think, *"Oh, what thoughtful developers protecting me from accidental clicks."* They think, **"This game is broken."**

Desktop players must be able to click weapon badges, click the assist toggle, click rewind, and click the carrier deck buttons. If you are afraid of accidental clicks, use a 0.2-second confirmation or clear visual hover styling—do not paralyze the user's input device!

### 1.3. The "False Victory" of Version 1.4.0
In `v1.4.0`, you created a non-lethal `TRAINING_SORTIE` to fix Issue #32. You wrote unit tests, verified it passed, and congratulated yourself with an 8.85 / 10 score in the release notes.

**Yet you left `DEFAULT_SCENARIO: ScenarioId = 'CARRIER_DEFENSE'`.**

Because of that single line of code, any player who visits `https://bejranonda.github.io/carrier-vector-1988/` and hits Enter or clicks the screen is dumped straight into `CARRIER_DEFENSE`, where SAM missiles are actively hunting them during flight checkout! Your training sortie was invisible to the very players who needed it most. That is engineering complacency: you built the feature, tested it in isolation, but failed to look at the actual player entry path.

---

## 2. Opposite Thinking: Challenging the Creator's Assumptions

| Sacred Assumption | The Opposite Truth / Critique | The Winning Compromise |
| :--- | :--- | :--- |
| *"A flight simulator must present all instruments on the HUD for authenticity."* | Under combat stress, 22 instruments create visual noise and cause cognitive blindness. | Implement an **"Arcade / Clean HUD"** by default (just target box, speed, alt, weapon). Reserve the full 22-instrument suite for a toggleable "Sim HUD". |
| *"Keyboard-only controls on desktop preserve purist retro arcade feel."* | 1980s arcades had physical throttles and sticks; modern desktop users have a mouse. Disabling mouse clicks makes the UI feel clunky and unresponsive. | Add full pointer hit-testing. Let desktop players click HUD weapon pills, assist toggles, and deck buttons. |
| *"Failure and early crashes teach the player respect for aerodynamic physics."* | Early unearned deaths cause immediate rage-quits. Novices do not learn from crashes they don't understand. | Give rookies 60 seconds of complete combat immunity in a guided flight school. Hook them on the power fantasy first; challenge them with stall physics second. |

---

## 3. Critiquing & Improving Your AI Prompts and Instructions

You asked: *"You can also suggest to improve this prompts, command and instruction here."*

Here is an analysis of your prompt habits and how to get vastly superior results from AI coding assistants:

### 3.1. Weaknesses in Your Current Prompting Approach
1. **The "All-in-One" Mega Prompt:**
   Your prompt asks for: (a) expert game review, (b) complexity critique, (c) desktop mouse evaluation, (d) multi-dimensional comparison, (e) scoring table, (f) recommendations, (g) systematic documentation structure, and (h) prompt advice.
   - *The Risk:* When an AI is given 8 massive conceptual deliverables in a single prompt, it is forced to balance broad summarization against deep actionable code.
2. **Mixing Philosophy with Code Architecture:**
   Asking an AI to "tell me how to improve the game" produces philosophical essays. Asking an AI to "implement mouse click hit-areas in `DeckView.ts` and `HUD.ts` with tests" produces working code.
3. **Missing Phased Execution:**
   The best practice is to separate **Review & Architecture** (Phase 1) from **Implementation & Verification** (Phase 2).

### 3.2. The 4-Block Formula for Directing AI Game Dev Agents
Whenever you instruct an AI assistant in this repository, format your prompt using this structure:

```markdown
### 1. ROLE & PHILOSOPHY:
"Act as a Veteran Game Designer who prioritizes player entertainment, visceral game feel, and zero-frustration onboarding."

### 2. CONTEXT & HARD CONSTRAINTS:
"Repository: Carrier Vector 1988.
Hard constraints: Pure TypeScript, zero external runtime dependencies, 1/120s fixed timestep, pure logic decoupled from Canvas2D. All changes must pass `npx vitest run`."

### 3. EXACT FEATURE SPECIFICATION:
"Implement [Feature Name].
- Modify: `src/path/FileA.ts`
- Add unit tests: `src/path/FileA.test.ts`
- Specific behavior: [Explain input, state change, and visual output]."

### 4. SUCCESS CRITERIA:
"1. Headless test suite passes 100%.
 2. Interactive elements respond to mouse clicks.
 3. Zero uncaught console errors."
```

---

## 4. Copy-Paste AI Master Prompts for Immediate Execution

Copy and paste these exact prompts into future AI sessions to implement the solutions identified in this review:

### Master Prompt 1: Desktop Mouse Interactivity (HUD & Deck Hit Areas)
```markdown
Agent, implement full desktop mouse click interactivity across the cockpit HUD and carrier deck in Carrier Vector: 1988.

Architectural Requirements:
1. In `src/renderer/TouchLayout.ts` or a new `src/renderer/PointerInteractivity.ts`, create a unified hit-testing solver for desktop screen dimensions.
2. In `src/renderer/DeckView.ts`, add clickable hit-areas for:
   - [LAUNCH CATAPULT] (executes `game.requestCatapultLaunch()`)
   - [RUSH TURNAROUND] (executes `game.rushTurnaround()`)
   - Fuel steppers [- 500L] and [+ 500L]
   - Ordnance steppers [+ Sidewinders] and [+ Bombs]
   - [VIEW COCKPIT] tab
3. In `src/renderer/HUD.ts`, add clickable hit-areas for:
   - Weapon pills (GUN, AIM9, MK82) to switch active weapon
   - Assist pill to cycle AUTOPILOT / ASSIST / MANUAL
   - Rewind pill to trigger 5-second rewind
   - Padlock pill to toggle target tracking
   - Deck pill to switch to carrier view
4. In `src/main.ts`, update the canvas `pointerdown` handler so that clicks in desktop mode trigger these actions and play a synthesized CRT relay click sound (`soundFX`).
5. Zero runtime npm dependencies. Write headless Vitest tests in `tests/PointerInteractivity.test.ts` verifying hit coordinates before modifying rendering code.
```

---

### Master Prompt 2: Dual HUD Mode ("Arcade Clean" vs. "Sim Pro")
```markdown
Agent, implement a Dual HUD Density system to eliminate beginner cognitive overload in `src/renderer/HUD.ts`.

Architectural Requirements:
1. In `src/renderer/DisplayMode.ts` or `src/renderer/HUD.ts`, add a `hudDensity: 'ARCADE' | 'PRO'` state (defaulting to 'ARCADE' for new players, toggleable via `H` or keybar click).
2. When `hudDensity === 'ARCADE'`:
   - Hide the pitch ladder rungs and roll indices.
   - Hide the G-meter, engine RPM, and vertical speed indicator (VSI).
   - Simplify airspeed and altitude to two clean, high-contrast digital boxes (`KTS` and `AGL FT`).
   - Draw an unambiguous, high-contrast target lock bracket with prominent "FIRE" prompt when in envelope.
3. When `hudDensity === 'PRO'`:
   - Render the complete 22-instrument telemetry suite as currently implemented.
4. Ensure all layout math maintains pure decoupling from Canvas2D rendering.
5. Write headless unit tests verifying that layout clipping and element suppression behave deterministically in both modes.
```

---

### Master Prompt 3: Rookie First-Run Shielding & Default Scenario Routing
```markdown
Agent, fix the beginner onboarding trap in `src/core/Scenarios.ts` and `src/core/GameLoop.ts`.

Requirements:
1. In `src/core/Scenarios.ts`:
   - If `clearedCount(records) === 0` (first-time pilot), set the default initial scenario to `TRAINING_SORTIE` instead of `CARRIER_DEFENSE`.
   - On the Briefing screen, add a prominent "ROOKIE FLIGHT SCHOOL (RECOMMENDED)" visual badge to scenario 6.
2. In `src/carrier/DeckManager.ts` and `src/tactics/SAMSite.ts`:
   - When any scenario has `showTrainingChecklist === true`, enforce absolute combat shielding: SAM sites must remain dormant and enemy aircraft must hold fire until all checklist steps are completed.
3. In `src/audio/CockpitVoiceSystem.ts`:
   - Add wingman radio callouts for checklist progression and first target kill ("Splash one! Outstanding shooting, 201!").
4. Zero runtime npm dependencies. Ensure all 800 existing Vitest tests continue to pass and add new test coverage for rookie scenario selection.
```
