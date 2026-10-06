# v2.2.0 — Recommendations & Roadmap

✅ shipped · 🔨 ready to build · 🤔 owner decision.

## Tier 0 — people (sixth release asking)

### P1 🔨 Pilot-customer round
Eight people: four under 40, four over 50, at least two who do not play games,
on their own devices - most will pick a phone. Record the first five minutes,
screen and voice. Measure: do they find EASY and text size; seconds to the
first kill; whether they press FLY AGAIN; whether they share a card; what they
say. Every EASY constant and every medal threshold (#97) is a bot-calibrated
guess until this happens.

## Tier 1 — shipped in v2.2.0 ✅

| Change | Where |
| :-- | :-- |
| Fighters keep their speed; capped turn rate; strafing passes | `EnemyAI.steerToward`, `EXTEND_RANGE` |
| Bombers come past the jet; never on the boat | `Scramble.spawnReference`, `keepClearOfBoat` |
| Waves CLEARED / HELD / OVER; jets fixed per run | `GameLoop.updateScramble` |
| EASY marked on cards, links, daily, debrief | `Challenge`, `DailySortie`, `Scramble` |
| Phone: one-control EASY kit, tap-anywhere fire, FIRE lights when ready | `TouchLayout.touchKitFor`, `GameLoop.updateTouch` |
| Phone: thumb wording; in-flight text boost; coach under the order strip | `Controls.touchWording`, `Theme.textScaling`, `HUD` |
| Share sheet from the debrief | `GameLoop.copyDailyCard` |
| Large text on laptops: banners, first screen, pause menu | `HUD.drawCallouts`, `briefingHitAreas`, `pilotMenuLayout` |
| #105-#124 | `KNOWN_ISSUES.md` |
| Player-facing link preview with an image | `index.html`, `public/og-image.png` |
| Headless balance sim, 16 seeds per profile in minutes | `npm run balance` (`scripts/balance/`) |

## Tier 2 — next, in order

### N1 🔨 "Add to home screen" for phone players (~60 LOC + icons)
A web app manifest (fullscreen, landscape) and PNG icons, so a phone player
can come back from an icon - and gets the whole screen, with no browser bar
eating 50 px of a 390 px display. Offer it once on the phone debrief.

### N2 🔨 Phone menus at large text (#103, ~100 LOC)
The briefing and the debrief on a phone: larger mission name, goal line and
buttons at LARGE / EXTRA LARGE, shedding the secondary lines to make room.

### N3 🔨 Fighters that fight like a pair (~120 LOC)
Extend-and-return shipped in v2.2.0; next a leader/wingman split, so a
STANDARD dogfight has shape. Measure with `npm run balance` before and after,
one change at a time, on every profile - v2.2.0 built a tail-sitter rule that
measured worse on all four and took it out.

### N4 🤔 EASY as a preset over individual assists
Auto-aim, world speed, damage and jets as separate switches, with EASY and
STANDARD as presets - the guidelines' "individually adjustable assists".

### N5 🤔 Type-scale pass (#104)
Fewer, larger labels so EXTRA LARGE meets 28 px at 1080p.

## What not to do next

- Do not lower the wave timeout to "fix" pacing: the stalls had causes, and
  they are fixed. A timeout that fires often again means a new cause.
- Do not tune EASY or the medals further by bot. The bots found the walls;
  people should set the numbers.
- Do not judge an AI or balance change on one run, or on two changes at
  once. `npm run balance` runs 16 seeds a profile in a few minutes; switch
  each change off once before believing it.
