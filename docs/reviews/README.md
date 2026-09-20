# Game Reviews & Design Specifications Hub

This directory is the systematic archive and evaluation hub for **Carrier Vector: 1988**. It tracks the evolution of the game's design, mechanics, player psychology, and entertainment value across release versions.

Future AI development agents and human contributors must consult this repository to understand past design critiques, ongoing architectural roadmaps, and guidelines for reviewing future versions.

---

## 1. Version Review Registry

| Version | Evaluation Date | Status | Overall Score | Key Focus & Milestones | Review Files |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`v1.3.0`** | 2026-09-20 | Archived Baseline | **5.71 / 10** | • **12-Dimensional Holistic Evaluation** (Loops, Voice, Padlock, Churn, Thermals)<br>• Live GitHub Pages playtest & onboarding failure analysis (Issue #32)<br>• Zero-dependency 6-DOF math engine review<br>• Blueprints for Bitchin' Betty Voice, Padlock Camera, Rogue-lite Campaign & Vector Juice | • [12-Dimension Review](v1.3.0/COMPREHENSIVE_GAME_REVIEW.md)<br>• [Roadmap & Blueprints](v1.3.0/RECOMMENDATIONS_AND_ROADMAP.md)<br>• [AI Master Prompts](v1.3.0/FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) |
| **`v1.4.0`** | 2026-09-20 | **Current Release** | **8.85 / 10** | • Non-Lethal Narrative Onboarding (`TRAINING_SORTIE`, Issue #32 resolved)<br>• Synthesized Cockpit Voice Warnings ("Bitchin' Betty")<br>• 3D Vector Line Fragmentation Debris ("Juice")<br>• Padlock Target-Tracking Camera (`V` key)<br>• Arcade 5-Second Time-Rewind ("Oops" button)<br>• Persistent Rogue-lite Campaign State Machine (7 sectors, radar attenuation) | • [Release Verification](v1.4.0/RELEASE_NOTES_AND_VERIFICATION.md) |

---

## 2. Directory Structure

```
docs/reviews/
├── README.md                                  # This master registry and SOP hub
├── REVIEW_TEMPLATE.md                         # Standardized 12-dimensional review protocol
│
└── v1.3.0/                                    # Version 1.3.0 Evaluation Suite (Baseline)
    ├── COMPREHENSIVE_GAME_REVIEW.md           # 12-Dimensional critique, scores & Good vs. Bad
    ├── RECOMMENDATIONS_AND_ROADMAP.md         # Voice alerts, padlock view, juice & Rogue-lite design
    └── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Creator critique & copy-paste AI master prompts
```

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

---

## 4. Related Core Documentation

* **[AI_DESIGN_REVIEW.md](../AI_DESIGN_REVIEW.md)** — Executive summary of review findings.
* **[FUN_REVIEW.md](../FUN_REVIEW.md)** — Tactical UX review of attention-flow, deck turnaround, and autopilot modes.
* **[KNOWN_ISSUES.md](../KNOWN_ISSUES.md)** — Active bug & design limitation tracker (see Issue #32).
* **[GUIDELINES.md](../GUIDELINES.md)** — Zero-dependency policy, Canvas2D performance rules, and headless testing standards.
* **[APPROACH_AND_METHOD.md](../APPROACH_AND_METHOD.md)** — Flight physics formulas and deck state machine patterns.
