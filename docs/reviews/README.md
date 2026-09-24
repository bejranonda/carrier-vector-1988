# Game Reviews & Design Specifications Hub

This directory is the systematic archive and evaluation hub for **Carrier Vector: 1988**. It tracks the evolution of the game's design, mechanics, player psychology, and entertainment value across release versions.

Future AI development agents and human contributors must consult this repository to understand past design critiques, ongoing architectural roadmaps, and guidelines for reviewing future versions.

---

## 1. Version Review Registry

| Version | Evaluation Date | Status | Overall Score | Key Focus & Milestones | Review Files |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`v1.3.0`** | 2026-09-20 | Archived Baseline | **5.71 / 10** | • **12-Dimensional Holistic Evaluation** (Loops, Voice, Padlock, Churn, Thermals)<br>• Live GitHub Pages playtest & onboarding failure analysis (Issue #32)<br>• Zero-dependency 6-DOF math engine review<br>• Blueprints for Bitchin' Betty Voice, Padlock Camera, Rogue-lite Campaign & Vector Juice | • [12-Dimension Review](v1.3.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Roadmap & Blueprints](v1.3.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [AI Master Prompts](v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.4.0`** | 2026-09-20 | Archived | **8.85 / 10** (Tech)<br>**6.32 / 10** (Player) | • **15-Dimensional Player Entertainment & Usability Review**<br>• Critique of Beginner Complexity & Screen Cognitive Overload (22 dials)<br>• Desktop Mode Mouse Interactivity Failure Analysis<br>• Rookie Onboarding Trap (`DEFAULT_SCENARIO` SAM ambush)<br>• Blueprints for Clean Arcade HUD, Mouse Hit-Areas & Dopamine Pacing | • [Release Verification](v1.4.0/RELEASE_NOTES_AND_VERIFICATION.md)<br>• [Player Experience Review](v1.4.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Recommendations & Roadmap](v1.4.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Suggestions & AI Prompts](v1.4.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.5.0`** | 2026-09-21 | Archived Baseline | **9.00 / 10** (Engineering)<br>**5.20 / 10** (Player)<br>**5.76 / 10** (Composite) | • **First review driven by verbatim human playtest evidence**<br>• Framework extended 15 → 21 dimensions<br>• Addressed missing countermeasures (`X` chaff), HARM anti-radiation missile (`4`), debrief post-mortem, and stick inversion on briefing | • [21-Dimension Review](v1.5.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Player Questions Answered](v1.5.0/PLAYER_QUESTIONS_ANSWERED.md)<br>• [Recommendations & Roadmap](v1.5.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Suggestions & Guidelines](v1.5.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.6.0`** | 2026-09-21 | **Implemented in v1.6.0** (review scores are the pre-fix baseline) | **7.67 / 10** (Engineering)<br>**4.32 / 10** (Player)<br>**4.99 / 10** (Composite) | • **Second human playtest evaluation** (GitHub Pages post-v1.5.0)<br>• Framework extended 21 → **25 dimensions** (Bank-to-Turn Aerodynamics, Tactical Radar vs RWR, On-Screen Guidance, Victory Pacing)<br>• **CRITICAL:** Decoupled Euler angles prevent turning via roll; pitch clamped at 88° prevents looping (jet only goes North)<br>• **CRITICAL:** Cryptic RWR conflatable with radar; lacks carrier, bandits, and terrain<br>• **CRITICAL:** Silent hit-scan cannon attrition from astern; instant cut to deck on death | • [**25-Dimension Review**](v1.6.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [**Player Questions Answered**](v1.6.0/PLAYER_QUESTIONS_ANSWERED.md)<br>• [**Roadmap & Code Blueprints**](v1.6.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [**Frank Suggestions & AI Prompts**](v1.6.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md)<br>• [**Implementation & Corrections (read first)**](v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md) |
| **`v1.7.0`** | 2026-09-21 | **Released** / Under Reconsideration | **8.50 / 10** (Tech)<br>**5.50 / 10** (Beginner)<br>**7.00 / 10** (Composite) | • Enlarged Tactical Radar / RWR display (+50% area for combat readability)<br>• Beginner Onboarding & Cognitive Load Reconsideration<br>• Root Cause Analysis of Default Scenario Onboarding Trap<br>• Blueprints for Auto-Targeting, Stall Diagnosis & Visceral Combat Feedback | • [v1.7.0 Release Review](review-v1.7.0.md)<br>• [**Reconsideration & Entertainment Audit**](v1.7.0/RECONSIDERATION_AND_ENTERTAINMENT_AUDIT.md) |
| **`v1.9.0`** | 2026-09-21 | **Released** | **8.17 / 10** (Engineering)<br>**6.67 / 10** (Player)<br>**7.20 / 10** (Composite) | • **First review to run the live build in a real browser and inspect rendered frames**<br>• Framework CUT 25 → **12 dimensions** (standing rule #8 finally honoured)<br>• **CRITICAL:** four pairs of HUD elements drawn into the same rectangle (objective strip ∩ compass tape; pill bar ∩ annunciator ∩ keycap strip; score chip ∩ buttons; help labels ∩ keycaps)<br>• **CRITICAL:** the "Zero combat hostiles" training sortie took 15% of the carrier's hull at T+20s<br>• **CRITICAL:** `TOO FAST FOR THE TRAP` fired on every launch, contradicting the objective and stalling beginners<br>• ARCADE HUD had deleted the artificial horizon — no attitude reference at all<br>• All five fixed, 11 regression tests added | • [**Suite index (read first)**](v1.9.0/README.md)<br>• [**Playtest Evidence**](v1.9.0/PLAYTEST_EVIDENCE.md)<br>• [12-Dimension Review](v1.9.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Recommendations & Roadmap](v1.9.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Suggestions & Prompt Critique](v1.9.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.10.0`** | 2026-09-23 | **Released** (implements v1.9.0) | **8.83 / 10** (Engineering)<br>**7.44 / 10** (Player)<br>**7.93 / 10** (Composite) | • Implemented the v1.9.0 roadmap **after measuring each recommendation first** — four changed<br>• **Physics defect found:** directional stability acted about the world axis, not the body axis (the real cause of "I pull and nothing happens")<br>• Recovery assist rebuilt: hands over **within 1 m** of the glideslope (was 34 m low, or into the sea)<br>• FIRST_FLIGHT HUD (3 optional regions), brief deck (4 panels), steering cue, missile carets<br>• Touch chaff + HARM, AZERTY-safe keys, crash screen, versioned feedback link<br>• **Browser harness checked in** (`npm run playtest`, 28 checks)<br>• ⚠ **No new human playtest** — scored by the implementer | • [**Suite index**](v1.10.0/README.md)<br>• [**Implementation Report (read first)**](v1.10.0/IMPLEMENTATION_REPORT.md)<br>• [Playtest Evidence](v1.10.0/PLAYTEST_EVIDENCE.md)<br>• [12-Dimension Review](v1.10.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Roadmap](v1.10.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Notes & Prompt Guidelines](v1.10.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.11.0`** | 2026-09-24 | **Released** | **9.00 / 10** (Engineering)<br>**7.72 / 10** (Player)<br>**8.17 / 10** (Composite) | • Desktop-focused fix round from four verbatim complaints: no menu, no idea what to do, too many keys, "let user have fun"<br>• **New: a real, clickable pilot pause menu** (`ESC`, a corner button, or the touch MENU control) that restates the objective in plain words and can hand the boring parts to the autopilot<br>• **Defect found:** ASSIST's held climb ran away to 85° of pitch and near-stall speed, in the *default* flight mode, following the game's own training-card instruction<br>• **Defect found:** "take me home" flew the jet to 7.9 km and diverging instead of turning around, when astern but pointed the wrong way<br>• Every scripted phase now pays off with a banner and a tone<br>• 1,029 tests (was 989), 33/33 browser checks (was 28)<br>• ⚠ **No new human playtest** — scored by the implementer | • [**Suite index (read first)**](v1.11.0/README.md)<br>• [Playtest Evidence](v1.11.0/PLAYTEST_EVIDENCE.md)<br>• [12-Dimension Review](v1.11.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Roadmap](v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [Frank Notes & Prompt Guidelines](v1.11.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |

### Score Trend

```
             v1.5.0   v1.6.0   v1.7.0   v1.8.0*  v1.9.0   v1.10.0  v1.11.0†
Engineering   9.00  →  7.67  →  8.50  →  7.00  →  8.17  →  8.83  →  9.00   ████████████████████▋
Player        5.20  →  4.32  →  5.50  →  5.94  →  6.67  →  7.44  →  7.72   █████████████████▏
Composite     5.76  →  4.99  →  7.00  →  6.31  →  7.20  →  7.93  →  8.17   ██████████████████▎

* v1.8.0 is scored as-found by the v1.9.0 review, not by a review of its own.
† v1.10.0 and v1.11.0 are scored by the agent that implemented them, with no
  new human playtest. Treat the player score as provisional until pilot
  feedback is in — three releases running have said this is the top priority
  and none has done it yet; see either suite's Frank Notes.
```

> **Why v1.8.0's engineering score sits below v1.7.0's:** no code got worse. v1.9.0
> is the first review to run the live build in a browser and look at rendered
> frames, and it found four shipped HUD collisions, a tutorial that damaged the
> player's own carrier, and a coaching hint that was wrong on every launch. Those
> defects were present in v1.7.0 too — five previous review suites simply could
> not see them, because they only ever read source. This is a measurement
> improvement, not a regression.

---

## 2. Directory Structure

```
docs/reviews/
├── README.md                                  # This master registry and SOP hub
├── REVIEW_TEMPLATE.md                         # Standardized review protocol
│
├── v1.3.0/                                    # Version 1.3.0 Evaluation Suite (Baseline)
│   ├── COMPREHENSIVE_GAME_REVIEW.md
│   ├── RECOMMENDATIONS_AND_ROADMAP.md
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md
│
├── v1.4.0/                                    # Version 1.4.0 Evaluation Suite
│   ├── RELEASE_NOTES_AND_VERIFICATION.md
│   ├── COMPREHENSIVE_GAME_REVIEW.md
│   ├── RECOMMENDATIONS_AND_ROADMAP.md
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md
│
├── v1.5.0/                                    # Version 1.5.0 Evaluation Suite (Archived)
│   ├── COMPREHENSIVE_GAME_REVIEW.md
│   ├── PLAYER_QUESTIONS_ANSWERED.md
│   ├── RECOMMENDATIONS_AND_ROADMAP.md
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md
│
├── v1.6.0/                                    # Second human-playtest review, and what came of it
│   ├── IMPLEMENTATION_AND_CORRECTIONS.md      # READ FIRST: what the review got wrong, what shipped, frank feedback
│   ├── COMPREHENSIVE_GAME_REVIEW.md           # 25-Dimensional review, good vs. bad, scores
│   ├── PLAYER_QUESTIONS_ANSWERED.md           # 6 Playtest questions answered with exact code evidence
│   ├── RECOMMENDATIONS_AND_ROADMAP.md         # Tiered fixes: Bank-to-Turn math, Radar, HUD Guidance
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Frank blame, opposite thinking, AI master prompts
│
├── v1.7.0/                                    # Radar readability & entertainment audit
│   └── RECONSIDERATION_AND_ENTERTAINMENT_AUDIT.md
│
├── v1.9.0/                                    # First browser-instrumented playtest review
│   ├── README.md                              # Suite index and headline numbers
│   ├── PLAYTEST_EVIDENCE.md                   # READ FIRST: measurements only, zero opinions
│   ├── COMPREHENSIVE_GAME_REVIEW.md           # 12-Dimensional review, scores, central critique
│   ├── RECOMMENDATIONS_AND_ROADMAP.md         # Ranked by impact / LOC (implemented in v1.10.0)
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Blunt feedback, opposite thinking, prompt critique
│
├── v1.10.0/                                   # The implementation of v1.9.0, measured first
│   ├── README.md                              # Suite index and headline numbers
│   ├── IMPLEMENTATION_REPORT.md               # READ FIRST: what shipped, what changed, 11 new defects
│   ├── PLAYTEST_EVIDENCE.md                   # 28/28 harness checks, before/after measurements
│   ├── COMPREHENSIVE_GAME_REVIEW.md           # 12-dimension re-score (no new human playtest)
│   ├── RECOMMENDATIONS_AND_ROADMAP.md         # Next: a pilot-customer feedback round
│   └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Where the review and the prompt were wrong
│
└── v1.11.0/                                   # Desktop fix round: menu, plain instructions, climb/recovery bugs
    ├── README.md                              # Suite index and headline numbers
    ├── PLAYTEST_EVIDENCE.md                   # READ FIRST: the measured defects and each fix, verified
    ├── COMPREHENSIVE_GAME_REVIEW.md           # 12-dimension re-score (no new human playtest)
    ├── RECOMMENDATIONS_AND_ROADMAP.md         # Next: still a pilot-customer feedback round, then N1/N2/R1
    └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Where the first recovery-bug fix attempt was wrong
```

### Which document do I read first?

| I am... | Read this |
| :--- | :--- |
| **Anyone, starting now** | [`v1.11.0/README.md`](v1.11.0/README.md) — the current suite |
| **An AI agent about to change code** | [`v1.11.0/PLAYTEST_EVIDENCE.md`](v1.11.0/PLAYTEST_EVIDENCE.md), then [`v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md`](v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md) — and run `npm run playtest` before and after |
| Wondering what to build next | [P1 — a pilot-customer feedback round](v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md#tier-0--still-before-anything-else-put-it-in-front-of-people), before any new feature |
| Wondering why the jet feels unresponsive | [`v1.9.0/PLAYTEST_EVIDENCE.md`](v1.9.0/PLAYTEST_EVIDENCE.md) §4 and §6 |
| Anyone about to act on the v1.6.0 review | [`v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md`](v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md) — several of its claims were stale or wrong |
| An AI agent about to implement fixes | [`v1.6.0/RECOMMENDATIONS_AND_ROADMAP.md`](v1.6.0/RECOMMENDATIONS_AND_ROADMAP.md) — but read the corrections first |
| Wondering why the jet only went North | [`v1.6.0/PLAYER_QUESTIONS_ANSWERED.md`](v1.6.0/PLAYER_QUESTIONS_ANSWERED.md) Q1 (and the deeper cause in the corrections §2) |
| Assessing project health & UX | [`v1.6.0/COMPREHENSIVE_GAME_REVIEW.md`](v1.6.0/COMPREHENSIVE_GAME_REVIEW.md) §0–§3 |
| Prompting an AI for the next sprint | [`v1.6.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`](v1.6.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) §4 |

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

### Standing Rules Added After the v1.9.0 Browser Playtest

These exist because five review suites (3,438 lines) read the source carefully
and none of them noticed that four pairs of HUD elements were being drawn into
the same rectangle on every frame at the default desktop resolution.

12. **A review without a rendered frame is not a review.**
    Every review must run the live build in a real browser, at a minimum of one
    desktop and one phone viewport, and inspect actual pixels. `npm run playtest`
    does this and saves every frame to `playtest-output/`. Source reading
    finds what the code *says*; only a screenshot finds what the player *sees*.
    A review that cannot show a frame must say so at the top and be down-weighted
    exactly as an empty Player Evidence section is.

13. **Every review must propose more deletions than additions.**
    Rule #10 asked for two deletions; it was not enough. Thirteen consecutive
    "make it easier for beginners" features all *added* something to the screen,
    and the screen ran out of room. If a review proposes a new UI element, it
    must name the element being removed to pay for it.

14. **Fix count beats finding count.**
    A review that ships three tested fixes beats one that catalogues thirty
    problems. Close the loop or do not open it. State plainly which findings you
    fixed, which you chose not to, and why — a finding left unfixed because it
    needs an owner's decision is a legitimate outcome; a finding left unfixed
    because cataloguing was easier is not.

---

## 4. Related Core Documentation

* **[AI_DESIGN_REVIEW.md](../AI_DESIGN_REVIEW.md)** — Executive summary of review findings.
* **[FUN_REVIEW.md](../FUN_REVIEW.md)** — Tactical UX review of attention-flow, deck turnaround, and autopilot modes.
* **[KNOWN_ISSUES.md](../KNOWN_ISSUES.md)** — Active bug & design limitation tracker (see Issue #32).
* **[GUIDELINES.md](../GUIDELINES.md)** — Zero-dependency policy, Canvas2D performance rules, and headless testing standards.
* **[APPROACH_AND_METHOD.md](../APPROACH_AND_METHOD.md)** — Flight physics formulas and deck state machine patterns.
