# v1.10.0 Review Suite — "Built, Measured, Launch-Ready"

The release that implemented the v1.9.0 review — after measuring each
recommendation first, which changed four of them — and prepared the game for
pilot customers.

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**IMPLEMENTATION_REPORT.md**](IMPLEMENTATION_REPORT.md) | **Start here.** What happened to every v1.9.0 recommendation, how four were improved before building, and 11 defects found along the way. |
| 2 | [**PLAYTEST_EVIDENCE.md**](PLAYTEST_EVIDENCE.md) | Measurements only: 28/28 browser checks, flight-model and recovery-assist before/after, screen inventory. |
| 3 | [COMPREHENSIVE_GAME_REVIEW.md](COMPREHENSIVE_GAME_REVIEW.md) | 12-dimension re-score. **No new human playtest** — read §0. |
| 4 | [RECOMMENDATIONS_AND_ROADMAP.md](RECOMMENDATIONS_AND_ROADMAP.md) | Next: a pilot-customer feedback round before any new building. |
| 5 | [FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md](FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) | Where the review and the prompt were wrong, and a better prompt. |

## Headline numbers

| | v1.9.0 | v1.10.0 |
| :-- | :-: | :-: |
| Composite score | 7.20 | **7.93** |
| Tests | 933 | **989** |
| Browser checks (`npm run playtest`) | ad hoc | **28 / 28, checked in** |
| Optional HUD regions a new pilot sees | 9 | **3** |
| Deck panels a new pilot sees | 8 | **4** |
| Held-bank turn, default settings | 7.2 °/s, nose climbing | **12.3 °/s, nose +6°** |
| Recovery assist glideslope error at hand-over | 34 m low (or into the sea) | **< 1 m** |
| Known issues closed | — | **17 existing + 11 found and fixed** |
