# v2.0.0 Review Suite — "Scramble"

The owner asked for something no previous suite asked: review the game
frankly, research what makes games hits, renovate it to win players, then
validate and keep criticising. This suite is that, in four parts.

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**COMPREHENSIVE_GAME_REVIEW.md**](COMPREHENSIVE_GAME_REVIEW.md) | **Start here.** The frank verdict on v1.11.0 as a *game a stranger finds*, a new 8-dimension "hit" rubric, what v2.0.0 changed and why, and the research behind it. |
| 2 | [PLAYTEST_EVIDENCE.md](PLAYTEST_EVIDENCE.md) | Every number: the harness (48/48), a button-masher and a steering bot, missile accounting, and a hypothesis the measurement killed. |
| 3 | [SELF_CRITIQUE.md](SELF_CRITIQUE.md) | What the implementer got wrong during the release, and what is still weak in the build. |
| 4 | [RECOMMENDATIONS_AND_ROADMAP.md](RECOMMENDATIONS_AND_ROADMAP.md) | What is next — starting, again, with real players. |

## Headline numbers

| | v1.11.0 | v2.0.0 |
| :-- | :-: | :-: |
| First kill after ENTER, new pilot | 13.9 s and four instructions (perfect bot) | **4.2 s and one key** |
| Reason to play again after a run | a bigger number | stars, XP, unlocks, a challenge link, `ENTER = FLY AGAIN` |
| "Hit" rubric mean (8 dims, §2 of the review) | 4.0 | **7.8** (implementer-scored; upper bound) |
| Tests | 1,029 | **1,107** |
| Browser checks | 33/33 | **48/48** |
| Known issues found and fixed this release | 5 | **9 (#88–#96)** |
| Bundle (gzip) | 82.0 kB | 93.4 kB |

## The one-line version

The engineering was never the problem; the order was. v2.0.0 keeps every bit
of the sim and puts the fight, the payout and the "again" button in front of
it — and, honestly, still has not been played by a single person who did not
build it.
