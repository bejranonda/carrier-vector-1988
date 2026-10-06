# v2.2.0 Review Suite — "Second Look"

The owner asked: *"Validate anything to improve else?"* This suite is the
answer: three independent code reviews of v2.0-v2.1, eight-minute balance runs
with a stall diagnosis, frames at the sizes the settings create - and the
fixes.

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**VALIDATION_REVIEW.md**](VALIDATION_REVIEW.md) | **Start here.** Method, the stall root causes, every finding and its fix, what was rejected, the re-score. |
| 2 | [PLAYTEST_EVIDENCE.md](PLAYTEST_EVIDENCE.md) | The stall diagnosis; 16-seed balance tables - v2.1.0 against v2.2.0, and each AI change switched on and off; medal timing; harness; screens. |
| 3 | [SELF_CRITIQUE.md](SELF_CRITIQUE.md) | What v2.0-v2.1 got wrong (found only now), what went wrong on the way, what is still weak. |
| 4 | [RECOMMENDATIONS_AND_ROADMAP.md](RECOMMENDATIONS_AND_ROADMAP.md) | People first; then "add to home screen", phone menus, fighters as a pair. |

## Headline numbers

| | v2.1.0 | v2.2.0 |
| :-- | :-: | :-: |
| EASY hold-fire, 8 min, 16-seed mean: kills / hull left | 26.9 / 73% | **39.8 / 87%** |
| STANDARD steering bot, 8 min: kills / runs shot down | 5.1 / 16 of 16 | **10.0 / 5 of 16** |
| Relaxed EASY player (fires only when told), 3 min: kills | 9.0 | **17.1** |
| Stall diagnostic, EASY, 5 min: seconds stuck without a kill | 167 s | **55 s** |
| Fighter speed while stuck (min) | 1 m/s (hovering) | 97 m/s |
| Controls on a phone, EASY in SCRAMBLE | 9 + RCVY | **1** (+ menu; tap anywhere fires) |
| Text size on a phone | did nothing | grows the in-flight words up to 1.4× |
| Issues found and fixed | 5 | **20 (#105-#124)** |
| Tests / browser checks | 1,134 / 61 | **1,185 / 66** |
| Non-gamer rubric mean (implementer-scored) | 7.6 | **8.1** |

## The one-line version

The fight had been stalling - enemy fighters bled their speed away until they
hovered, then (once fixed) sat on your tail; bombers flew away from you; and
the EASY coach hid FIRE NOW behind a line that asked for nothing. Three
reviews found twenty more bugs, from a death that carried into the next run
to a phone that showed nine controls where EASY needs one. All fixed and
measured over 16 seeds a profile (`npm run balance`) - which also threw out
one plausible fix that made every profile worse. None of it yet seen by a
human player.
