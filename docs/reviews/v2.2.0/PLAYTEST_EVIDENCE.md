# v2.2.0 — Playtest Evidence

Two instruments, **no humans**: the headless balance sim (`npm run balance` -
the real `GameLoop`, a stub canvas, 16 seeds per profile, `Math.random`
seeded so every run replays) for every number that decides something, and
headless Chromium (Playwright, a frozen development build, the
`window.__game` handle) for diagnosis and for looking. Four scripted players:

- **EASY hold-fire** - picks EASY and holds FIRE for the whole run; never
  steers (EASY's own advice, taken literally).
- **STANDARD steering** - bang-bang keyboard steering toward the designated
  target, missiles when on the nose, guns inside 1.2 km. Crude on purpose: it
  wastes missiles and flies into gunfire.
- **Relaxed EASY / relaxed STANDARD** (v2.1.0's profile) - looks every 1.5 s,
  presses FIRE only when the screen says FIRE, never steers.

## 1. The stall diagnosis (5 minutes, EASY)

A bot that logs every live contact relative to the jet whenever 12 s pass
without a kill.

| | v2.1.0 AI | + fighters keep their speed | + strafing passes |
| :-- | :-: | :-: | :-: |
| Kills | 14 | 25 | **29** |
| Seconds with no kill for 12 s+ (and contacts alive) | 167 | 99 | **55** |
| ... hovering fighters (< 80 m/s) | 94 | 0 | 0 |
| ... bombers > 3.5 km, out of reach | 58 | 0 | 0 |
| Fighter speed in those seconds, min / median | 1 / 75 m/s | 130 / 177 m/s | 97 / ~180 m/s |
| Contact range in those seconds, median | - | **150 m** (tail-sitting) | 1,291 m (between passes) |
| Wave reached | 6 | 7 | **9** |

The middle column is the fixed speed law alone: no more hovering, but
fighters now sat 50-300 m on the jet's tail, inside missile minimum range and
outside the gun cone. The strafing pass is what turned that into shots.

A sample from the first column, one MiG every few seconds (range m / speed m/s):
`859/150 → 628/112 → 565/68 → 643/40 → 792/25 → 973/16 → 1481/8 → 2234/5`.

## 2. Many runs: v2.1.0 against v2.2.0

`npm run balance`, 16 seeds per profile; the same harness and seeds on both
builds (v2.1.0 from a worktree at its tag).

| Profile | Build | Kills (range) | Waves counted | Score | Jets lost | Hull | Runs shot down |
| :-- | :-- | :-: | :-: | :-: | :-: | :-: | :-: |
| EASY hold-fire, 8 min | v2.1.0 | 26.9 (20-38) | 8.9 | 12,644 | 0 | 73% | 0/16 |
| | **v2.2.0** | **39.8 (32-51)** | **10.3** | **18,497** | 0 | **87%** | 0/16 |
| STANDARD steering, 8 min | v2.1.0 | 5.1 (3-7) | 4.1 | 2,006 | 3.0 | 55%\* | 16/16 |
| | **v2.2.0** | **10.0 (7-13)** | **5.9** | **3,297** | **1.9** | 32%\* | **5/16** |
| Relaxed EASY, 3 min | v2.1.0 | 9.0 (9-9) | 4.0 | 5,016 | 0 | 100% | 0/16 |
| | **v2.2.0** | **17.1 (13-21)** | **5.7** | **9,317** | 0 | 100% | 0/16 |
| Relaxed STANDARD, 3 min | v2.1.0 | 6.0 | 4.0 | 3,442 | 0 | 100% | 0/16 |
| | v2.2.0 | 6.0 | 4.0 | 3,442 | 0 | 100% | 0/16 |

"Waves counted" is stricter in v2.2.0 (a wave with no kill no longer counts,
#107), so the rise understates the change. \* Hull is not comparable for the
steering bot: every v2.1.0 run was shot down by about 4-5 minutes, before the
later waves' bombers came; most v2.2.0 runs flew all eight minutes and met
them. Relaxed STANDARD is unchanged and should be: a pilot who never steers
on STANDARD meets only what flies into the nose - the game offers EASY to
that pilot (v2.1.0).

### What decided the AI changes

Each change switched off and on with everything else held:

| Change | EASY hold-fire, 8 min | STANDARD steering, 8 min | Relaxed EASY, 3 min | Verdict |
| :-- | :-: | :-: | :-: | :-- |
| Strafing pass (break off inside 450 m), off -> on, final build, 16 seeds | 32.8 -> **39.8** kills; hull 95% -> 87% | 11.6 -> 10.0 kills; shot down 7/16 -> **5/16** | 16.8 -> 17.1 kills | **Kept**: a fifth more kills on EASY, fewer STANDARD runs shot down - for a little hull and a few STANDARD kills |
| Tail break-off (4 s in the rear half, 1.2 km), off -> on, 8-16 seeds | 39.9 -> 33.2 kills | shot down 2/16 -> 6/16 | 18.1 -> 12.5 kills | **Removed** |

The tail rule was built for a stall the per-wave log showed - a MiG circling
on a relaxed EASY player's tail for a minute - and went into the same build
as the coach fix for the same stall (FIRE NOW was hidden behind "enemy behind
you"). The pair measured better than before; the tail rule alone measured
worse everywhere. The coach was the cause.

### Medal reachability (#97), 16 seeds, v2.2.0

| Star | EASY hold-fire: median (range), runs | STANDARD steering bot |
| :-- | :-- | :-- |
| CLEAR WAVE 5 | 1:46 (1:45-1:57), 16/16 | 5:34 (5:32-6:56), 16/16 |
| SCORE 8,000 IN ONE RUN | 2:26 (2:12-4:14), 16/16 | 0/16 (best 5,053) |
| CLEAR WAVE 10 | 7:16 (5:17-7:58), 15/16 in 8 min | 0/16 |

On EASY one long run earns the set; on STANDARD the crude bot earns the
first star and nothing else - a person who steers with intent should do
better. Still to be set by people (#97).

### Single browser runs, for looking

One run per row, random seeds - the instrument that nearly decided the
strafing pass the wrong way (the "+ strafing passes" EASY row: 19 kills, every
wave from the fourth timing out, against 30-47 in the sim's runs of the same
build).

| Build | Profile | Kills | Waves counted | Score | Jets lost | Hull | End |
| :-- | :-- | :-: | :-: | :-: | :-: | :-: | :-- |
| v2.1.0 AI | EASY | 30 | 10 | 15,865 | 0 | 52% | alive at 8:00 |
| v2.1.0 AI | STANDARD | 3 | 4 | 966 | 3 | 40% | shot down at 4:36 |
| speed fix (old wave counting) | EASY | 34 | 9 | 16,519 | 0 | 84% | alive |
| speed fix (old wave counting) | STANDARD | 16 | 7 | 7,399 | 3 | 10% | shot down at 6:38 |
| all fixes but passes | EASY | 36 | 9 | 16,435 | 0 | **100%** | alive |
| all fixes but passes | STANDARD | 10 | 7 | 2,439 | 2 | 10% | alive at 8:00 |
| + strafing passes | EASY | 19 | 7 | 8,135 | 0 | 100% | alive at 8:00 |
| + strafing passes | STANDARD | 8 | 5 | 3,404 | 3 | 25% | shot down at 7:56 |
| **v2.2.0 as shipped** | EASY | **34** | 9 | 15,519 | 0 | **100%** | alive at 8:00 |
| **v2.2.0 as shipped** | STANDARD | **17** | 7 | 4,104 | 2 | 10% | alive at 8:00 |

The shipped build in a real browser agrees with the sim: the EASY run sits
inside the sim's 16-seed range (32-51) and tracks its wave timeline to within
a few seconds through wave 7. The STANDARD run is above the sim's range
(7-13) - the browser bot steers through real input latency, and it is one
run.

## 3. Harness — 66/66

New since v2.1.0's 61: on both phones, EASY in SCRAMBLE shows only FIRE and
the menu; a tap anywhere on the world fires when a shot is good; the chaff
button still works in a deck mission; an upright phone's briefing takes a tap
and the flight then asks for landscape. (The chaff check failed 2 of 61 on the
first run - it still looked for chaff in SCRAMBLE, where it is now hidden.)

## 4. Screens

| Screen | Before | After |
| :-- | :-- | :-- |
| Briefing, 1080 × 650, EXTRA LARGE (720 × 433 layout) | FLY button on the phase cards; options through the button; loss line through both | cards dropped, loss line under the goal, button above three option rows |
| Phone 844 × 390, EASY flight | stick, throttle, 4 pills, chaff, target, fire, lit RCVY; speed and altitude blocks; `PRESS SPACE OR CLICK` | one big FIRE (lit when a shot is good), menu; `FIRE NOW - TAP FIRE` |
| Phone 844 × 390, EXTRA LARGE | identical to NORMAL (no zoom on phones) | order strip ×1.4, coach ×1.4, banners ×1.4; coach under the strip |
| Phone 932 × 430, STANDARD, EXTRA LARGE | zoomed 1.075 (crowded) | no zoom; strip clear of the airspeed block; target not under the coach |
| Pause menu, 844 × 390 | MISSION SELECT below the screen | two columns |

## 5. Link preview

`public/og-image.png`, 1200 × 630, 244 kB (128-colour PNG - under the ~300 kB
WhatsApp limit): a real frame - canyon walls, a SPLASH banner, a kill ring and
a locked MiG - under the title, "SCRAMBLE! SHOOT DOWN THE BOMBERS. SAVE THE
CARRIER." and "FREE IN YOUR BROWSER · EASY MODE: THE PLANE FLIES ITSELF".

## 6. Build

305.7 kB, 100.8 kB gzip (v2.1.0: 296.2 / 97.1). Zero runtime dependencies.
