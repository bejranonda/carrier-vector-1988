# v2.1.0 — Recommendations & Roadmap

✅ shipped · 🔨 ready to build · 🤔 owner decision.

## Tier 0 — people, deliberately including older players

### P1 🔨 Pilot-customer round (five releases overdue)
Eight people: four under 40, **four over 50**, at least two who do not play
games. Their own devices (most will choose a phone). Record the first five
minutes, screen + voice. Measure: do they find EASY / text size, seconds to
first kill, whether they press FLY AGAIN, what they say. Every EASY constant
(80% speed, 90° cone, five jets) is a bot-calibrated guess until this happens.

## Tier 1 — shipped in v2.1.0 ✅

| Change | Where |
| :-- | :-- |
| "How would you like to fly?" asked once | `FlyStyleView.ts`, `GameLoop.requestFlight` |
| EASY flying: autopilot intercept, always-on lock, smart trigger, hold to fire, 90° cone | `EasyMode.ts` |
| EASY forgiveness: 80% speed, half damage, five jets, missile trickle, longer messages, less shake | `EASY_TUNING` |
| Text size as UI zoom, `T` everywhere | `Theme.uiZoomFor`, `GameLoop.resize` |
| Plain-language orders | `Tutorial.ts`, `Scramble.ts` |
| Mouse-only play | `main.ts` |
| "Having a hard time?" EASY offer after two lost jets | `GameLoop.offerEasyIfStruggling` |
| #98-#102 | `KNOWN_ISSUES.md` |

## Tier 2 — next, in order

### N1 🔨 Phone type scale (#103, ~60 LOC)
A touch-specific set of larger fonts for the objective strip, coach line and
banners (the three things an EASY pilot reads), instead of a whole-UI zoom.

### N2 ✅ "Having a hard time? Try EASY"
Shipped in v2.1.0's final pass: two jets lost in a STANDARD run offers EASY
once. Next step: notice other struggles (repeated mission failure, no kills).

### N3 🔨 EASY as a preset over individual assists (~80 LOC)
Auto-aim, world speed, damage, jets as separate switches in a settings panel,
with EASY / STANDARD as presets. Meets the guidelines' "individually
adjustable assists".

### N4 🔨 Auto-trap on EASY (~50 LOC)
Let the recovery assist fly the last 300 m to the wire when EASY is on.

### N5 🤔 Type-scale pass (#104)
Fewer, larger labels so that EXTRA LARGE meets 28 px at 1080p. A design
decision about how much HUD the game keeps.

## What not to do next

- Do not tune EASY further by bot. It has done its job: it found the wall and
  showed the fix moved it.
- Do not make EASY the default for returning players. They chose the game
  they had; a setting that changes under them is a broken promise.
