# v2.2.0 — "Second Look": a validation review of v2.0–v2.1

The brief, verbatim: *"Validate anything to improve else?"*

Reviewer: the agent that built v2.0.0 and v2.1.0, with three independent
review agents it dispatched. **No human playtest** - see §6.

---

## 1. Method

| Instrument | What it was asked | What it found that nothing else did |
| :-- | :-- | :-- |
| **Three code reviews in parallel** (game loop + input; core logic; rendering + audio) | Real bugs only, each with file:line, a failure scenario and, where cheap, a throwaway test against the real modules | A death carried into the next run; waves paying for bombers let through; jets changing mid-run; a daily that lost its mode on reload; text size switching the control scheme; banners vanishing at large text |
| **Eight-minute balance runs** (STANDARD steering bot, EASY hold-fire bot) | Are the medals reachable, and how does a long run feel? | ~40% of an EASY run spent waiting on one or two unreachable contacts |
| **A stall-diagnostic bot** | Whenever 12 s pass without a kill, log every live contact relative to the jet | The cause was physics and geometry, not tuning (§2) |
| **A headless balance sim** (now `npm run balance`) | The real `GameLoop`, a stub canvas, 8-16 seeds per profile at ~50-100× real time; per-wave logs on demand | Single browser runs were too noisy to decide anything. The sim decided the strafing pass, found the coach hiding FIRE NOW, and threw out a plausible fix that made every profile worse |
| **Frames at the sizes the settings create** | The briefing, the cockpit and the menus at LARGE / EXTRA LARGE on laptop windows and phones | The first screen collapsed at 1080 × 650 EXTRA LARGE; nine phone controls where EASY needs one |

**Every review finding was re-read at its code site before it was fixed.**
Each serious fix has a regression test, and the tests for the worst ones were
run against the old code to confirm they fail there (the steering law: 4 of 4;
the MAYDAY carry-over: fails without the fix).

---

## 2. The headline: the fight stalled, and the cause was not balance

The three-minute runs of v2.1.0 looked healthy. Eight minutes did not: on
EASY, waves 4 and 5 each took ~100 s against a 15-40 s norm, the plane turning
circles with six missiles on the rails.

The diagnostic bot logged 167 stalled seconds in a five-minute EASY run:

| Cause | Share | What the log showed |
| :-- | :-: | :-- |
| **Hovering fighters** | 56% | Two MiGs in ENGAGE, speed falling 150 → 112 → 68 → 40 → 25 → 16 → 8 → **3 m/s**, a kilometre below the jet, pointed at it but going nowhere |
| **Bombers out of reach** | 35% | A bomber 9 km ahead running for the carrier at 190 m/s; the jet chasing at 160 m/s, climbing |
| Other | 9% | Transitions |

**Hovering fighters (#105).** `steerToward` blended the velocity toward
`direction × speed` with the climb component halved - a target vector shorter
than the speed - and a straight-line blend through a ~180° reversal passes
almost through zero. The speed was then re-read from the shrunken vector, so
every turn bled it for good. After its first head-on pass a fighter never
recovered. This is the shared AI: every mission's fighters did it.
*Fix:* rotate the velocity at a capped rate (~16°/s) and hold the contact's
own speed.

**Bombers out of reach (#106).** Bombers were placed off the jet's nose and
fly to the carrier; a jet that had drifted far out, nose toward home, could
only chase them from behind. *Fix:* place bombers off the far side of the jet
from the carrier, so their run passes it; never within 2.5 km of the boat.

**Then the next wall: tail-sitters.** The same diagnostic on the fixed AI
showed no hovering fighters and no unreachable bombers - and a new stalemate:
fighters that now kept their speed, and out-turned the jet, parked 50-300 m
behind it (median 150 m), inside missile minimum range and outside the gun
cone, for most of a wave. *Fix:* a fighter that closes inside 450 m breaks
off and extends for 4 s, guns cold, then comes round again - a strafing pass.

**And the wall after that.** A single eight-minute browser run with passes
came out *worse* (19 kills against 36). Rather than argue with one run, a
headless simulation ran the real game loop at many times real speed over
many seeds (§1). It showed passes helping on average - and, logged per wave
on the profile that regressed (a relaxed EASY player who fires only when
told), a minute-long stall: a MiG circling on the jet's tail, and the EASY
coach saying "enemy behind you - the plane will turn to fight" (which asks
nothing of the pilot) while a shot sat in the cone. Two fixes went in
together: a break-off rule for tail-sitters, and FIRE NOW outranking every
coach line but a missile in the air.

**Measured one at a time, only the second was a fix.** With the tail rule
switched off, the relaxed player made 18.1 kills in three minutes; with it
on, 12.5 - and the rule cost the hold-fire bot a sixth of its kills and ended
three times as many steering-bot runs early. The MiG on the tail was a
symptom; the hidden FIRE NOW was the cause. The rule came out, and the lesson
went into the method (`APPROACH_AND_METHOD.md` §15): two fixes measured
together are one fix measured.

Neither would have been found by tuning the wave timeout - the obvious fix,
and the wrong one.

**Net, v2.1.0 -> v2.2.0, 16 seeds a profile** (`PLAYTEST_EVIDENCE.md` §2):
EASY holding fire, 26.9 -> **39.8** kills in eight minutes; the STANDARD
steering bot, 5.1 -> **10.0** kills, shot down in 16 of 16 runs -> 5 of 16; a
relaxed EASY player who fires only when told, 9 -> **17.1** kills in three.

---

## 3. Findings and fixes

Severity as the reviewers rated it, after verification.

| # | Finding | Severity | Fix |
| :-: | :-- | :-: | :-- |
| 109 | RESTART during the MAYDAY sequence (or any airborne start) began the next run with dead controls, slow motion and a jet already lost | **High** | Run state reset in `applyScenario`, the one place every start passes |
| 112 | Below a 436 px layout - EXTRA LARGE on any laptop window under ~600 px - no two-line banner was drawn: kills, WAVE, NOT YET, MAYDAY | **High** | The newest banner always gets room |
| 105 | Enemy fighters stopped in mid-air | High (found by measurement) | Rotate, cap, hold speed |
| 106 | Bombers flew away from the jet; one could spawn on the boat | Medium | Outbound placement; 2.5 km clearance |
| 107 | A wave let through paid like one shot down (a run that never fired could earn the first star) | Medium | CLEARED / HELD / OVER |
| 108 | Switching EASY off mid-run could end it on the spot | Medium | Jets fixed at run start |
| 113 | The first screen collapsed at large text on a laptop | Medium | Button above the options; cards only where they fit |
| 114 | The pause menu ran off a landscape phone | Medium | Two columns |
| 115 | A tap on the debrief card flew again and threw the card away - phones could never share | Medium | Tap shares (native sheet) or copies |
| 116 | Text size switched the control scheme on tablets; insets went stale | Medium | Detection in CSS px |
| 119 | EASY: training prompt hid FIRE NOW for a whole deck sortie; steering orders outside SCRAMBLE | Medium | EASY skips the checkout; coach rewritten from the real strings |
| 122 | Music played on in a hidden tab | Medium | Stop + pause on hide |
| 110 | A SCRAMBLE day lost its mode on reload | Medium | `sanitise` keeps every field |
| 111 | Nothing said a run was flown on EASY | Medium (fairness) | Marked on cards, links, daily, debrief |
| 117, 118, 123 | Phones: nine controls on EASY, keyboard words, upright taps ignored | Medium (audience) | Touch kits, `touchWording`, menus take upright taps |
| 120, 121, 124 | Trigger honesty, held keys, stuck mouse trigger, VETERAN stars, rewind after respawn, terrain re-acquire, corrupt-save freeze, daily restart, CARRIER LOST headline, glows, stale comments | Low | Each fixed; see `KNOWN_ISSUES.md` |

### Rejected or deferred

- **Shorter wave timeout** - would have hidden #105 and #106, not fixed them.
- **Zooming phones a little** - v2.1.0 measured 1.08 crowding the cockpit; the
  phone fix grows only the words read in flight (#103).
- **Auto-chaff on EASY** - unnecessary once it was clear nothing in SCRAMBLE
  fires a missile at the jet; the chaff button is simply not shown there.

---

## 4. Beyond bugs: three improvements the validation pointed at

1. **Phones as a one-button game.** The audience v2.1.0 was built for plays
   on phones (AARP: 84% of players over 50). On a phone, EASY in SCRAMBLE now
   shows one big FIRE that lights up when a shot is good, a tap anywhere also
   fires, every instruction uses words for a thumb, the in-flight text grows
   with the setting, and the result card goes straight to the share sheet.
2. **Honest records.** EASY runs are marked wherever a score can be compared;
   a wave says CLEARED only when it was.
3. **The first impression outside the game.** The page described itself as
   "6-DOF aerodynamics ... zero 3D engines" - which is what a friend saw when a
   challenge link was pasted into a chat. It now speaks to players and carries
   a preview image rendered from the game.

---

## 5. Scoring (implementer, provisional)

The v2.0.0 "hit" rubric, for a non-gamer:

| Dimension | v2.1.0 | v2.2.0 | Why |
| :-- | :-: | :-: | :-- |
| Hook | 8 | 8 | Unchanged |
| Core loop | 7 | **8** | No dead air waiting on stragglers; fighters come back for passes |
| Juice | 8 | 8 | Unchanged (FIRE now lights when a shot is good) |
| Goals | 7 | **8** | Stars mean what they say; on EASY two inside ~2.5 min, the third at ~7 min (15 of 16 runs inside 8) |
| Persistence | 7 | 7 | Unchanged |
| Again | 9 | 9 | Unchanged |
| Shareability | 8 | **9** | Share sheet on phones; a link preview with an image; honest EASY marks |
| Clarity | 7 | **8** | Thumb words on phones; text size works there; fewer controls |
| **Mean** | **7.6** | **8.1** | |

---

## 6. What this review cannot say

A bot does not get bored, confused by a word, or tired. Every number above is
from scripts and reviews of code; whether a 70-year-old enjoys EASY on a phone
is still unmeasured. **Sixth release running: the pilot-customer round is the
most valuable next step**, and it is ready to run (see the roadmap).
