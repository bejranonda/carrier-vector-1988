# v1.11.0 Review Suite — "Click, Fly, Have Fun"

A desktop-focused review and fix round, answering four verbatim complaints
from the same reviewer who drove v1.9.0's review: no menu, no idea what to
do, too many keys, and — mid-session — "let user have fun to play too."

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**PLAYTEST_EVIDENCE.md**](PLAYTEST_EVIDENCE.md) | **Start here.** Measurements: the 90-second stalled climb, the 85° pitch runaway, the 7.9 km "take me home" divergence, and the fixes verified against each. |
| 2 | [COMPREHENSIVE_GAME_REVIEW.md](COMPREHENSIVE_GAME_REVIEW.md) | 12-dimension re-score. **No new human playtest** — read §0. |
| 3 | [RECOMMENDATIONS_AND_ROADMAP.md](RECOMMENDATIONS_AND_ROADMAP.md) | What shipped, what's next, and — still — a pilot-customer feedback round before anything else. |
| 4 | [FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md](FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) | Where the first fix attempt for the recovery bug was wrong, and a better prompt. |

## Headline numbers

| | v1.10.0 | v1.11.0 |
| :-- | :-: | :-: |
| Composite score | 7.93 | **8.17** |
| Tests | 989 | **1,029** |
| Browser checks (`npm run playtest`) | 28 / 28 | **33 / 33** |
| Way to pause and see what to do | None | A real, clickable pilot menu (`ESC`, a corner button, or the touch MENU control) |
| Pitch reached holding W (default flight mode) | 85°, near-stall | **Capped ~35°** |
| "Take me home" from 640 m astern, pointed away | Diverged to 7.9 km and climbing | **Hands over within 1.4 km, ~30 s** |
| Known issues found and fixed this release | 11 (v1.10.0) | **5 (#83–#87)** |

## What this release deliberately did not build

A `FIRST_FLIGHT` briefing, a friendlier training-sortie middle step, and a
ghost-lead autopilot that actually flies the climb rather than holding wings
level — all scoped out for time, all recorded honestly in the roadmap rather
than shipped as smaller, quieter versions of themselves.
