# Game Reviews & Design Specifications Hub

This directory is the systematic archive and evaluation hub for **Carrier Vector: 1988**. It tracks the evolution of the game's design, mechanics, player psychology, and entertainment value across release versions.

Future AI development agents and human contributors must consult this repository to understand past design critiques, ongoing architectural roadmaps, and guidelines for reviewing future versions.

---

## 1. Version Review Registry

| Version | Evaluation Date | Status | Overall Score | Key Focus & Milestones | Review Files |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`v1.3.0`** | 2026-09-20 | Archived Baseline | **5.71 / 10** | • **12-Dimensional Holistic Evaluation** (Loops, Voice, Padlock, Churn, Thermals)<br>• Live GitHub Pages playtest & onboarding failure analysis (Issue #32)<br>• Zero-dependency 6-DOF math engine review<br>• Blueprints for Bitchin' Betty Voice, Padlock Camera, Rogue-lite Campaign & Vector Juice | • [12-Dimension Review](v1.3.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Roadmap & Blueprints](v1.3.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [AI Master Prompts](v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.4.0`** | 2026-09-20 | Archived | **8.85 / 10** (Tech)<br>**6.32 / 10** (Player) | • **15-Dimensional Player Entertainment & Usability Review**<br>• Critique of Beginner Complexity & Screen Cognitive Overload (22 dials)<br>• Desktop Mode Mouse Interactivity Failure Analysis<br>• Rookie Onboarding Trap (`DEFAULT_SCENARIO` SAM ambush)<br>• Blueprints for Clean Arcade HUD, Mouse Hit-Areas & Dopamine Pacing | • [Release Verification](v1.4.0/RELEASE_NOTES_AND_VERIFICATION.md)<br>• [Player Experience Review](v1.4.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Recommendations & Roadmap](v1.4.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Suggestions & AI Prompts](v1.4.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.5.0-dev`** | 2026-09-20 | **Current (Working Tree)** | **9.00 / 10** (Engineering)<br>**5.20 / 10** (Player)<br>**5.76 / 10** (Composite) | • **First review driven by verbatim human playtest evidence**<br>• Framework extended 15 → **21 dimensions** (Counterplay, Convention Conformance, Toolset Completeness, Teachability, Failure Legibility, Accessibility)<br>• **BLOCKER:** `recommendScenario()` routes first-time pilots past `TRAINING_SORTIE` into combat<br>• **BLOCKER:** tutorial teaches `[A]` for autopilot — `[A]` is roll-left<br>• **Zero countermeasures exist**; SAM missile is infinite-turn-rate pure pursuit<br>• `IRON_HAND` SEAD mission ships with no anti-radiation weapon | • [21-Dimension Review](v1.5.0-dev/COMPREHENSIVE_GAME_REVIEW.md)<br>• [**Player Questions Answered**](v1.5.0-dev/PLAYER_QUESTIONS_ANSWERED.md)<br>• [Recommendations & Roadmap](v1.5.0-dev/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Suggestions & Prompt Guidelines](v1.5.0-dev/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |

### Score Trend

```
Engineering  8.85 ██████████████████▏  →  9.00 ██████████████████▌   +0.15
Player       6.32 ████████████▋        →  5.20 ██████████▍           -1.12  ← REGRESSION
```

> **Why the player score fell while engineering rose:** v1.4.0 built a safe
> tutorial mission, a pitch-inversion toggle, and an arcade HUD — then left all
> three unreachable by default, and shipped the tutorial with a wrong key.
> **The project's deficit is not missing features; it is unreachable ones.**

---

## 2. Directory Structure

```
docs/reviews/
├── README.md                                  # This master registry and SOP hub
├── REVIEW_TEMPLATE.md                         # Standardized 21-dimensional review protocol
│
├── v1.3.0/                                    # Version 1.3.0 Evaluation Suite (Baseline)
│   ├── COMPREHENSIVE_GAME_REVIEW.md           # 12-Dimensional critique, scores & Good vs. Bad
│   ├── RECOMMENDATIONS_AND_ROADMAP.md         # Voice alerts, padlock view, juice & Rogue-lite design
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Creator critique & copy-paste AI master prompts
│
├── v1.4.0/                                    # Version 1.4.0 Evaluation & Player Experience Suite
│   ├── RELEASE_NOTES_AND_VERIFICATION.md      # Technical validation (800 tests passing, 6 systems)
│   ├── COMPREHENSIVE_GAME_REVIEW.md           # 15-Dimensional player review, complexity & mouse critique
│   ├── RECOMMENDATIONS_AND_ROADMAP.md         # Desktop mouse hit-areas, Dual HUD & onboarding blueprints
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Frank blame, opposite thinking & AI master prompts
│
└── v1.5.0-dev/                                # Working-tree review (post-v1.4.0, unreleased)
    ├── COMPREHENSIVE_GAME_REVIEW.md           # 21-Dimensional review, verified defects, good vs. bad
    ├── PLAYER_QUESTIONS_ANSWERED.md           # Human playtest questions traced to file:line evidence
    ├── RECOMMENDATIONS_AND_ROADMAP.md         # Tiered fixes sorted by player impact ÷ lines of code
    └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Process critique, opposite thinking, prompt redesign
```

### Which document do I read first?

| I am... | Read this |
| :--- | :--- |
| An AI agent about to implement fixes | [`v1.5.0-dev/RECOMMENDATIONS_AND_ROADMAP.md`](v1.5.0-dev/RECOMMENDATIONS_AND_ROADMAP.md) — Tier 0 first, in order |
| Wondering why a player was confused | [`v1.5.0-dev/PLAYER_QUESTIONS_ANSWERED.md`](v1.5.0-dev/PLAYER_QUESTIONS_ANSWERED.md) |
| Assessing overall project health | [`v1.5.0-dev/COMPREHENSIVE_GAME_REVIEW.md`](v1.5.0-dev/COMPREHENSIVE_GAME_REVIEW.md) §0 |
| Planning the next review | [`REVIEW_TEMPLATE.md`](REVIEW_TEMPLATE.md) + [`v1.5.0-dev/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`](v1.5.0-dev/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) §3 |

---

## 3. How to Conduct Reviews for Future Versions (AI & Contributor SOP)

When a new version (e.g., `v1.4.0`, `v2.0.0`) is prepared:

1. **Create the Version Directory:**  
   Create a new directory `docs/reviews/v<Version>/` (e.g., `docs/reviews/v1.4.0/`).
2. **Follow the Standardized Template:**  
   Copy [`REVIEW_TEMPLATE.md`](REVIEW_TEMPLATE.md) into the new version folder as `COMPREHENSIVE_GAME_REVIEW.md`.
3. **Mandatory Live Playtest:**  
   Perform a live session on the deployment or local preview (`npm run dev`) to record real player telemetry, input friction, and onboarding pacing.
4. **Calculate Version Deltas:**  
   Compare categorical scores against the previous baseline (`v1.3.0`) in the scoring table to track whether "Game Feel", Onboarding, and Campaign depth actually improved.
5. **Update Master Registry:**  
   Add the new release entry to the Version Review Registry table in this `README.md`.

### Standing Rules Added After the v1.5.0-dev Review

These exist because the v1.3.0 and v1.4.0 reviews both correctly identified the
onboarding trap, and it survived into v1.5.0-dev anyway.

6. **Human playtest evidence is mandatory.**
   Every review must include a `## Player Evidence` section containing *verbatim*
   confusions from at least one human who has not read the docs. If it is empty,
   say so explicitly and down-weight the review's confidence. **Do not invent
   player experience.** The three human sentences in the v1.5.0-dev review found
   more real defects than the preceding 958 lines of AI review.

7. **Every claim needs a `file:line` citation.**
   If a finding cannot be traced to source, mark it `unverified`. This is what
   turned "the SAM feels unfair" into "the missile re-points with unbounded
   angular rate at `RadarLOS.ts:340-344`", which is actionable.

8. **The framework must not grow unless something is cut.**
   It went 10 → 12 → 15 → 21 dimensions across four reviews. A rubric that only
   grows creates the feeling of thoroughness while making prioritisation harder.
   Adding a dimension requires merging or removing one.

9. **Every recommendation carries an effort estimate and a strict order.**
   Sort by *player impact ÷ lines of code*. Flag anything that is
   "interesting to build but low player impact" — that bias is the documented
   root cause of the onboarding trap surviving three releases.

10. **Recommend deletions, not only additions.**
    At least two "consider cutting this" items per review. Cutting is cheaper
    than building and often has a larger retention effect.

11. **If the review is longer than the fix, the review is the problem.**
    Cap comprehensive reviews at ~400 lines.

---

## 4. Related Core Documentation

* **[AI_DESIGN_REVIEW.md](../AI_DESIGN_REVIEW.md)** — Executive summary of review findings.
* **[FUN_REVIEW.md](../FUN_REVIEW.md)** — Tactical UX review of attention-flow, deck turnaround, and autopilot modes.
* **[KNOWN_ISSUES.md](../KNOWN_ISSUES.md)** — Active bug & design limitation tracker (see Issue #32).
* **[GUIDELINES.md](../GUIDELINES.md)** — Zero-dependency policy, Canvas2D performance rules, and headless testing standards.
* **[APPROACH_AND_METHOD.md](../APPROACH_AND_METHOD.md)** — Flight physics formulas and deck state machine patterns.
