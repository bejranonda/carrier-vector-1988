# v1.9.0 Review Suite — "Look at the Pixels"

The first review in this project's history to run the **live build in a real
browser** and inspect rendered frames, rather than reasoning from source.

It found four pairs of HUD elements being drawn into the same rectangle, a
tutorial that damaged the player's own carrier, and a coaching hint that gave
dangerous advice on every launch — none of which the preceding 3,438 lines of
review had noticed, because none of them had ever looked at a screenshot.

---

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**PLAYTEST_EVIDENCE.md**](PLAYTEST_EVIDENCE.md) | **Start here.** Raw measurements only — telemetry, pixel arithmetic, `file:line`. No opinions. Everything else cites this. |
| 2 | [**COMPREHENSIVE_GAME_REVIEW.md**](COMPREHENSIVE_GAME_REVIEW.md) | Scores across 12 dimensions, what is good, what is bad, and the central critique. |
| 3 | [**RECOMMENDATIONS_AND_ROADMAP.md**](RECOMMENDATIONS_AND_ROADMAP.md) | Ranked by impact ÷ LOC. Says what shipped, what is ready to build, and what needs an owner's decision. |
| 4 | [**FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md**](FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) | The blunt version, where the reviewer thinks the project is wrong, where previous reviews were wrong, and a critique of the review prompt itself. |

**If you are an AI agent about to change code:** read (1) for facts, then (3) for
the ranked backlog. Do not act on (2) or (4) without (1).

---

## Headline numbers

| | v1.8.0 (as found) | v1.9.0 (as shipped) |
| :-- | :-: | :-: |
| Engineering & Craft | 7.00 | **8.17** |
| Player Experience | 5.94 | **6.67** |
| Composite | 6.31 | **7.20** |
| Tests | 921 | **932** |
| HUD element pairs sharing pixels | **4** | **0** |

---

## The five defects this review found

1. **Objective strip ∩ compass tape** — the mission order and the heading tape
   printed through each other, every frame, at every resolution.
2. **Pill bar ∩ assist annunciator ∩ keycap strip** — three elements, one 35 px
   band.
3. **Score chip ∩ top-right buttons** — score and rank drawn under `DECK (TAB)`.
4. **The tutorial strafed your own carrier** — 100% → 85% hull at T+20s on the
   mission whose tagline reads *"Zero combat hostiles"*.
5. **`TOO FAST FOR THE TRAP` fired on every launch** — contradicting the objective
   strip directly above it, and stalling the jet if obeyed.

All five are fixed, with 11 new regression tests.

## The one defect this review deliberately did not fix

**Turn rate (7–10 °/s) and the instant roll snap to 75°.** Measured and
documented in Evidence §6. It is the mechanical root of *"hard to control the
jet"* — and changing it moves every mission's timing budget, which is the owner's
call, not a reviewer's. Three options are laid out in
[Recommendations R2](RECOMMENDATIONS_AND_ROADMAP.md#r2--turn-rate-and-roll-feel).

## The one thing to build next

[**R1 — the `FIRST FLIGHT` HUD**](RECOMMENDATIONS_AND_ROADMAP.md#r1--first-flight-hud-show-five-things-hide-the-other-twenty-two):
horizon, speed, altitude, one objective line, one key hint. Nothing else. On by
default until the first sortie is complete. ~150 lines, every component already
built.
