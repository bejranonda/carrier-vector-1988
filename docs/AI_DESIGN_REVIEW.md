# Carrier Vector 1988: Game Design Review & Development Roadmap

> ## ⚠️ Superseded — read the v1.11.0 suite first
>
> This document is kept as a historical snapshot. The current evaluation is
> [**`docs/reviews/v1.11.0/`**](reviews/v1.11.0/README.md) (a real pilot pause
> menu, plain-language coaching, an ASSIST climb-attitude limiter, and a fixed
> "take me home" recovery bug), which builds on
> [`docs/reviews/v1.10.0/`](reviews/v1.10.0/README.md) (the implementation of
> the v1.9.0 review) and
> [`docs/reviews/v1.9.0/`](reviews/v1.9.0/README.md), the first review to run
> the live build in a real browser and inspect rendered frames rather than
> reasoning from source.
>
> v1.9.0 found what every source-reading review before it had missed: **four
> pairs of HUD elements being drawn into the same rectangle**, a tutorial that
> damaged the player's own carrier, and a coaching hint that was wrong on every
> launch. v1.11.0 found that the game's own training-card instruction stalled
> the jet at 85° of pitch, and that the recovery assist could fly the jet away
> from the carrier forever. Start with
> [**`PLAYTEST_EVIDENCE.md`**](reviews/v1.11.0/PLAYTEST_EVIDENCE.md) —
> measurements only, no opinions — then the
> [roadmap](reviews/v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md).
>
> **Scores below are stale.** Current (v1.11.0): Engineering 9.00, Player 7.72
> (provisional - no new human playtest), Composite 8.17.

> **Note:** This review evaluates the state of *Carrier Vector: 1988* as of v1.6.0. It provides a brutally honest, unsugarcoated critique of the game's mechanics, UX, and progression, followed by actionable recommendations for future AI-assisted development. This version includes insights from a live playtest of the GitHub Pages build.
>
> 📁 **Detailed Review Suite:** For the systematic review collection and version archive, see [`docs/reviews/`](reviews/README.md), containing:
> - [`v1.6.0 Active Review Suite`](reviews/v1.6.0/COMPREHENSIVE_GAME_REVIEW.md) (25-dimensional review: Bank-to-Turn aerodynamics, Tactical Radar, In-flight guidance)
> - [`v1.6.0 Player Questions Answered`](reviews/v1.6.0/PLAYER_QUESTIONS_ANSWERED.md) (Rigorous file:line evidence on why the jet only goes North)
> - [`v1.6.0 Recommendations & Roadmap`](reviews/v1.6.0/RECOMMENDATIONS_AND_ROADMAP.md) (Tier 0-3 implementation blueprints)
> - [`v1.5.0 Archived Baseline`](reviews/v1.5.0/COMPREHENSIVE_GAME_REVIEW.md) (Countermeasures, HARM missile, death post-mortem)
> - [`v1.4.0 Archived Review`](reviews/v1.4.0/COMPREHENSIVE_GAME_REVIEW.md) (Desktop mouse interactivity, Dual HUD)
> - [`v1.3.0 Archived Review`](reviews/v1.3.0/COMPREHENSIVE_GAME_REVIEW.md) (Multi-dimensional baseline critique)
> - [`v1.9.0 Current Review Suite`](reviews/v1.9.0/README.md) (**current** — browser-instrumented playtest, 12 dimensions)
> - [`Standard Review Template`](reviews/REVIEW_TEMPLATE.md) (Standardized 12-dimension protocol, cut from 25 in v1.9.0)

## 1. Current State Critique & Scoring

### 1.1. Core Mechanics & Flight Model (Score: 8.5/10)
**The Good:** 
The 6-DOF flight model is an engineering marvel for a zero-dependency browser game. The aerodynamic physics (induced drag, symmetric stall, real ballistics) provide a shockingly deep ceiling for mastery. The terrain masking and radar line-of-sight mechanics are brilliant because they force the player to make tactical trade-offs between visibility and safety.

**The Bad:** 
The macro-loop (Deck Management) is severely underbaked compared to the micro-loop (Flight). Despite the addition of the "Rush turnaround" mechanic, the carrier deck is largely a waiting room for a state machine to finish. There are no grand strategic choices regarding fleet positioning, long-term resource scarcity, or deck layout optimization. You built a "dual-loop simulation," but one loop is a masterpiece and the other is a glorified progress bar.

### 1.2. UX & Accessibility (Score: 9/10)
**The Good:** 
The decision to decouple "flying the plane" from "tactical combat" via the `AUTOPILOT` assist was the single best UX decision made. Adapting the game for mobile by leaning into the autopilot and tap-to-designate mechanics is a masterclass in cross-platform design without dumbing down the core product. The flash-safe warnings and color-blind palette show extreme maturity.

**The Bad:** 
While the controls are accessible, the *cognitive load* is still immense for a new player. The game drops you into an intense military simulation with a "checklist" tutorial. Checklists are for engineers, not for gamers looking to be entertained. It is dry and lacks narrative framing to ease the player in.

### 1.3. Visuals, Audio & "Feel" (Score: 7.5/10)
**The Good:** 
The procedural Web Audio mix is fantastic. The audio spatialization (e.g., a SAM launching off the left wing) turns sound into critical tactical telemetry. The CRT phosphor decay and bloom give it a distinct identity. The game runs flawlessly in the browser and looks incredible in motion.

**The Bad:** 
The game looks "cool" to a programmer, but it lacks the visceral *punch* required to attract a wider modern audience. The visual feedback on enemy destruction is sterile. Where is the screen-tearing electronic warfare? The explosive vector particle effects? The game feels too clinical.

### 1.4. Campaign & Progression (Score: 4/10)
**The Good:** 
The Daily Sortie is a great retention hook, creating a shared experience.

**The Bad:** 
There is no campaign. The story is just text on a briefing card. There are no stakes because nothing carries over between missions. If I lose a jet in Mission 2, who cares? I just restart. Without persistent consequences (losing airframes, draining carrier resources, pilots dying), the game is just a series of isolated arcade levels. The "Canyon Strike" has no second act—it's a single pass and done. 

### 1.5. Live Playtest Experience: The Onboarding Failure
During a live playtest of the GitHub Pages build, a major pacing flaw was exposed. A new player taking off from the catapult is immediately presented with the "Flight Checkout" checklist. However, if the player intuitively pulls back on the stick to climb (pitching up to 80 degrees), they immediately break the terrain mask and are locked by a SAM. The screen flashes `MISSILE LAUNCH — GET LOW`, and the jet is destroyed in seconds, throwing the player back to the deck. 
**Critique:** You cannot ask a player to read a checklist while they are actively being hunted by supersonic missiles. The tutorial and the combat are fighting each other for the player's attention.

---

## 2. Frank Suggestions: The "Harsh Truth"

**You are designing like an engineer, not like an entertainer.** 

You are incredibly proud of the fact that this uses "zero 3D engine dependencies" and "hand-written linear algebra". **Players do not care about your linear algebra.** They care about how the game makes them *feel*. You have built a brilliant simulation engine, but you haven't built a compelling *game* around it yet. The mechanics are there, but the soul (stakes, narrative, progression) is missing. 

Furthermore, your idea of a "mission" is too static. A mission shouldn't just be "fly here, drop bomb." A real combat sortie is chaotic. Targets move. Intel is wrong. SAM sites pop up unexpectedly. 

---

## 3. Recommendations for Future Development

Here is the roadmap for how you (and future AI agents) should improve this game to make it attractive, understandable, and deeply engaging.

### 3.1. How to make it easy to understand and play
*   **Narrative-Driven Onboarding (Fixing the Playtest Issue):** The current tutorial is broken because it happens in a live combat zone. Replace the dry "Flight Checkout" checklist with a scripted, safe narrative mission (`TRAINING_SORTIE`). Have a fictional Wingman guide the player. "Keep it low, Nugget, they're painting us!" teaches terrain masking far better than a manual. Do not spawn lethal SAMs until the player has checked off basic flight controls.
*   **Synthesized Cockpit Voice Warnings ("Bitchin' Betty"):** Modern fighter cockpits rely on voice alerts. Add zero-dependency synthesized alerts (*"PULL UP"*, *"WARNING: MISSILE LAUNCH"*, *"STALL"*, *"BINGO FUEL"*) to eliminate visual distraction during high-G combat.
*   **Padlock Target-Tracking Camera (`V` Key):** Add a camera key slaving the view toward the designated contact to eliminate the 60° forward boresight blindfold during turning dogfights.
*   **The "Oops" Button:** For `ARCADE` mode, add a time-rewind mechanic. If a player eats a SAM, let them rewind 5 seconds to try dodging it. It lowers frustration and keeps them in the game loop.

### 3.2. How to get it attractive (Visuals & Marketing hooks)
*   **Juice the Visuals:** You have a vector engine. Use it! When an enemy bomber explodes, it shouldn't just vanish—shatter the vector lines into 3D physics-driven debris with phosphor trails. Add distance-scaled screen shake and scanline glitch effects when jammed by radar.
*   **Dynamic Music:** Layer a driving, 1980s synth-heavy arpeggiated bassline into `WebAudioSystem.ts` that accelerates tempo when locked by hostile radar.
*   **Retro Gun-Camera VHS Replay:** Allow players to export a 15-second retro HUD recording post-sortie for viral social sharing.

### 3.3. How to fix the Macro Loop & Campaign (The Big Suggestion)
*   **Persistent Dynamic Campaign:** Convert the game into a rogue-lite campaign. 
    *   **The Carrier is your base:** You have 24 F-14s, 12 A-6s, and finite fuel/missiles.
    *   **Node-based map:** You choose which sectors of the Norwegian Sea to strike. Striking a radar site lowers enemy SAM threat in adjacent nodes. 
    *   **Consequences:** If you lose a plane, it's gone from the carrier's inventory for the rest of the campaign. If the carrier takes too much damage, the campaign is over.
*   **Multi-Stage Missions:** AI should be tasked with rewriting the `Scenarios.ts` engine to support mid-mission state changes. "Objective updated: A secondary SAM site just powered on, take it out before RTB."

---

## 4. Notes for AI Prompting & Future Automation

To the human developer: When you instruct AI (like Claude or myself) to update this game, use the following prompt structures to ensure we don't break your pure math engine:

> **Suggested Prompt for AI Development:**
> *"Agent, we are implementing a persistent Rogue-lite campaign layer in `carrier/DeckManager.ts` and `core/Scenarios.ts`. Review `docs/APPROACH_AND_METHOD.md` first. Ensure all new state is strictly deterministic and separated from the view layer. Add a 'Resource Management' system where airframes lost in `flight/AircraftPhysics.ts` are permanently decremented from the carrier's global inventory across missions. Write unit tests for this state transition before touching the UI."*

**AI Instruction Guidelines:**
1.  **Always enforce the Zero-Dependency rule:** Remind the AI not to import external libraries.
2.  **Separate Pure Logic from View:** Force the AI to write unit tests for the pure data logic before it is allowed to touch `renderer/`.
3.  **Ask for "Juice":** When asking the AI to add visual effects, use the term "Game Feel" or "Juice" so it knows to focus on easing functions, camera shake, and particle decay rather than just basic drawing.
