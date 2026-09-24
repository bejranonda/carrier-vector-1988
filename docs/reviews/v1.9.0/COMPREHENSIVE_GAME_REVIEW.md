# Carrier Vector: 1988 — v1.9.0 Comprehensive Game Review

**Reviewer:** AI game-review agent · **Date:** 2026-09-21
**Build reviewed:** `v1.8.0` (commit `d7fb93d`) — live build and source
**Evidence:** [`PLAYTEST_EVIDENCE.md`](PLAYTEST_EVIDENCE.md) — every claim below cites it
**Framework:** 12 dimensions (cut down from 25; see
[`../REVIEW_TEMPLATE.md`](../REVIEW_TEMPLATE.md))

---

## 0. The one-paragraph verdict

This is a **beautifully engineered game with a legible-screen problem so severe
it reads as a complexity problem.** The playtester said *"there is a lot of info
on the screen"* — and they were being generous. Four pairs of HUD elements were
being drawn into the *same rectangle* at the default desktop size, every frame.
The mission order and the heading tape were printed through each other. The
score was underneath a button. The fix was not "show less information"; it was
"stop printing information on top of other information". Separately, the default
HUD mode had deleted the artificial horizon in the name of decluttering, which
is why *"it is hard to understand how to control the jet"* — the single number
that explains an unresponsive turn (nose 36° high) was not on screen anywhere.
Both are now fixed. What remains is a genuine design problem the repo has been
circling for six releases: **every attempt to make this game easier has added
something to the screen.**

| | v1.7.0 | v1.8.0 (as found) | v1.9.0 (as shipped) |
| :-- | :-: | :-: | :-: |
| **Engineering & Craft** | 8.50 | 7.00 | **8.17** |
| **Player Experience** | 5.50 | 5.94 | **6.67** |
| **Composite** (0.35 / 0.65) | 7.00 | 6.31 | **7.20** |

The v1.8.0 engineering score is *below* v1.7.0's not because code got worse, but
because this is the first review to run an instrumented browser playtest rather
than read source — and it found four shipped rendering collisions and one
tutorial that damaged the player's own carrier. Those were always there. The
previous reviews simply could not see them, because they never looked at the
pixels.

---

## 1. Scores by dimension

| # | Dimension | v1.8.0 | v1.9.0 | Δ | One-line reason |
| :-: | :-- | :-: | :-: | :-: | :-- |
| 1 | First five minutes | 4.5 | **6.0** | +1.5 | Routing to the tutorial works; the tutorial no longer shoots your carrier |
| 2 | Screen legibility | 3.0 | **7.0** | +4.0 | Four overlapping element pairs eliminated; bands now derived and tested |
| 3 | Control feel | 4.5 | **5.5** | +1.0 | Attitude reference restored; turn rate and roll snap unchanged |
| 4 | Micro-loop (guns, locks, kills) | 6.0 | 6.0 | — | Hit markers, debris, trauma all land well; targeting still needs a manual `[T]` habit |
| 5 | Mission & session structure | 7.5 | 7.5 | — | Six scenarios, phase director, objective line — a real strength |
| 6 | Retention & meta | 7.5 | 7.5 | — | Daily sortie, per-mission records, milestones, ranks |
| 7 | Deck loop (macro) | 3.5 | 3.5 | — | Still a waiting room with a spreadsheet attached |
| 8 | Art, audio, atmosphere | 8.5 | 8.5 | — | The best thing in the project |
| 9 | Narrative voice & writing | 8.5 | 8.5 | — | Ghost-Lead, the tactical log, the loss conditions: genuinely good writing |
| 10 | Engineering quality | 9.0 | **9.0** | — | 932 tests, zero deps, pure testable solvers |
| 11 | Accessibility & platform reach | 7.0 | **7.5** | +0.5 | Colour-blind, reduced-motion, excellent touch build; desktop still worse than phone |
| 12 | Docs vs. code honesty | 5.0 | **8.0** | +3.0 | Stale clamp claim, duplicate section numbers and framework-size mismatch corrected |

---

## 2. What is good — and it is a lot

**The engineering is not in question.** 932 passing tests across 51 files, strict
TypeScript, zero runtime dependencies, 75 kB gzipped, hand-written 6-DOF
dynamics, radar line-of-sight with real terrain masking, procedural audio. The
layout solvers (`DeckLayout`, `HudLayout`, `TouchLayout`) are pure functions with
their own test suites. This is the work of someone who cares.

**The writing is the secret weapon.** *"Ghost-Lead: Good launch, 201. Pull back
gently to 2,500 ft."* · *"Tired crews turn aircraft around more slowly."* ·
*"The blast doors close in four minutes. Lose a jet and you can rearm and go
again — but the clock does not stop."* That last line is a better tutorial for
what the mission *is* than any diagram would be. Most indie games would kill for
this voice.

**The briefing screen is genuinely well-designed.** Mission pills with difficulty
pips, a `START HERE` marker on the recommended one, a `NOT YET FLOWN` record
line, three numbered phase cards with the keys drawn as keycaps, and one pulsing
`ENTER · FLY THIS MISSION`. It is the clearest screen in the game and it does its
job.

**The phone build is better than the desktop build.** On a 844×390 phone the deck
screen is four panels and one large `LAUNCH` button (Evidence §8). Same code,
same game state, radically clearer — because a phone forced the team to choose.
The simplified experience this game needs *already exists and already ships*.

**The atmosphere is excellent.** CRT warm-up, phosphor persistence, the catapult
stroke, spatialised SAM launches, the death cinematic that holds the cockpit at
0.3× and tells you `KILLED BY MiG-23`. The 1988 fantasy is completely intact.

**There is real retention architecture.** Daily seeded sortie with a shareable
card, per-mission best scores, first-time milestones (`FIRST BLOOD!`, `OVER THE
TOP`), ranks, a recommendation engine. Most projects at this scale have none.

---

## 3. What is bad

### 3.1 The screen was printing on top of itself (fixed)

Not "cluttered" — **colliding**. Objective strip 54–108 px versus compass tape
76–108 px. Pill bar 848–882 versus annunciator 848–870 versus keycap strip
873–883. Score chip 18–44 versus button row 16–44. Help-overlay labels running
into the next column's keycaps. Four pairs, all unconditional, all at 1440×900.
(Evidence §2.)

The cause is instructive: the project *built* pure layout solvers precisely so
that "no two instruments overlap" would be testable — and then positioned these
seven elements with hand-written offsets that bypassed them. The architecture was
right; the discipline lapsed.

### 3.2 The default HUD deleted the artificial horizon (fixed)

`drawPitchLadder` returned immediately in ARCADE mode — *"keep the center of the
screen clean and uncluttered!"* — which also removed the zero rung, i.e. the
horizon. The player banks, pulls, and the heading does not move; the reason is
that the nose is 36° above the horizon and the turn is going into the vertical
plane. **That number was on no instrument anywhere.** Decluttering removed the
one thing that explains the controls. (Evidence §4, §6.2.)

### 3.3 The game's most-shown hint was wrong every time (fixed)

`distanceToCarrier < 2500 && airSpeed > 95` is true by construction for the first
seconds of every catapult shot ever taken. So `TOO FAST FOR THE TRAP — REDUCE TO
BELOW 90 M/S` fired on every launch, directly below an objective strip reading
`CLIMB TO 2,500 FT`, at 201 m altitude — where obeying it stalls the jet. A
first-time pilot's first two on-screen instructions contradicted each other and
one of them was lethal. (Evidence §3.)

### 3.4 The tutorial shot the player's own carrier (fixed)

`TRAINING SORTIE`, tagline *"Zero combat hostiles"*, loss condition *"Running out
of fuel or ditching in the fjord"* — took CV-68 from 100% to 85% hull at T+20s
while the new player was still reading the deck screen. `combatShielded` was
checked in four places, all protecting the player's aircraft; the deck's own
damage path never consulted it. (Evidence §5.)

### 3.5 The deck screen is a spreadsheet, and it is the first thing you see

Eight panels, ~35 numbers, four progress-bar groups — on a tutorial. It contains
two self-contradictions in a single frame: it offers a bomb loadout the ship has
zero of, and its `EARLY WARNING RADAR` labels the training drone
`1 INBOUND / FIGHTER 0:18` in red on the mission that promised no hostiles.
(Evidence §8.) **Not fixed — this is a design decision, not a bug. See
Recommendation R5.**

### 3.6 The jet turns at 7–10 °/s and the roll is a toggle

A 180° reversal takes 17–25 s (Evidence §6.1). Holding `A` snaps the bank to the
75° cap instantly and pins it there — there is no proportional feel, no sense of
a wing loading up. This is the mechanical core of *"hard to control"*, and it is
**deliberately not changed here**: retuning it moves every mission's timing
budget, and that is the owner's call, not a reviewer's. (Recommendation R2.)

### 3.7 The throttle parks at 150% afterburner and nothing brings it back

The v1.8.0 anti-stall floor raises throttle but never lowers it. A new pilot who
touches no throttle key spends the whole sortie in full AB, climbing, burning
138 L in 25 s of flying nowhere — which is *how* they end up in the nose-high
state of §3.2. (Evidence §6.3. Recommendation R3.)

### 3.8 The reviews are now a cost centre

Five review suites, 20 files, **3,438 lines** — and the top three player
complaints are *identical across all five*. The framework grew 10 → 12 → 15 → 21
→ 25 dimensions while the standing rule in `reviews/README.md` explicitly forbids
growth without a cut. More review is not what this project is short of.

---

## 4. The central critique: you have been adding, not subtracting

Every accessibility feature this repo has shipped since v1.3.0 **added something
to the screen**:

> coach ticker · objective strip · training checklist · assist annunciator ·
> arcade pill bar · rewind pill · padlock pill · chaff pill · status telemetry
> pill · STICK button · HUD-density button · enlarged radar scope · score chip

Thirteen additions, all justified individually, all aimed at making the game
*easier*. The result is 27 simultaneous draw regions, 33 labelled values, 29 key
bindings — and a screen so full that four pairs of elements ended up occupying
the same pixels. **The cure became the disease.**

The v1.4.0 review counted 22 dials and asked for fewer. v1.5.0 added chaff and
HARM. v1.6.0 added a radar scope and milestones. v1.7.0 made the radar *bigger*.
v1.8.0 added auto-targeting and more debris. Not one release deleted anything.

A beginner does not need more help *on top of* the screen. They need a smaller
screen. That is Recommendation R1, and it is the most important thing in this
review.

---

## 5. Is it fun?

**Yes — once, and about ninety seconds in.** The catapult stroke is great. The
first gun kill with the new 28-fragment debris and camera trauma genuinely lands.
The first arrested landing is a real achievement. The canyon at low level with a
SAM painting you is a fantasy this game delivers on.

The problem is everything before that ninety seconds, and it is not a content
problem — the content is good. It is that the player spends the first ninety
seconds reading. Briefing (24 items, 14 keys) → deck spreadsheet (8 panels, 35
numbers) → cockpit (27 regions, 29 keys). Three walls of text before the first
interesting decision.

**Time from page load to the first thing that feels like flying a jet: ~75 s,
almost all of it reading.** Compare: *Ace Combat* puts you in the air in 15 s.
That gap is the entire retention problem.

---

## 6. What I would cut (two mandatory per the standing rules)

1. **The keycap cheat strip** (`drawKeyBar`, 10 pairs across the bottom). It
   duplicates the help overlay, duplicates the pill labels, and contributed to
   the bottom-band collision. `H` is one keypress away. **Delete it** and give
   the space back to the horizon.
2. **The `DECK CREW STAMINA` panel on the deck screen.** Four percentages a
   first-time player can do nothing about, which change nothing they will
   experience in the next four minutes. Fold it into one line inside
   `TURNAROUND` and free a whole panel.

Honourable mention: the `REWIND 5S` and `PADLOCK` pills are permanent screen
furniture advertising features most players will never press. Make them appear
only when relevant, as the chaff pill already does.

---

## 7. What shipped in v1.9.0 as a result of this review

Tier 0 only — the defects that are unambiguous, small, and testable. Everything
requiring a balance or design decision is a *recommendation*, not a change.

| Fix | Files | Tests added |
| :-- | :-- | :-: |
| Top band stack derived, non-overlapping | `HUD.ts` | 2 |
| Bottom band stack derived, non-overlapping | `HudLayout.ts`, `HUD.ts` | 4 |
| Score chip moved below the button row | `HUD.ts` | — |
| Help-overlay labels clipped to their column | `BriefingScreen.ts` | — |
| Horizon bar + signed pitch readout in ARCADE | `HUD.ts` | — |
| Trap-speed hint requires an actual approach | `Tutorial.ts`, `GameLoop.ts` | 2 |
| Shielded scenarios cannot damage the carrier | `DeckManager.ts`, `GameLoop.ts` | 3 |
| Control labels shortened at the single source | `Controls.ts` | — |

**932 tests passing. Typecheck clean. Bundle +0.4 kB gzip.**

---

## 8. Honest limits of this review

* **One human playtester, two sentences.** Everything else is instrumented
  measurement and source reading. Two sentences from a real beginner found more
  than 3,438 lines of prior review did — that ratio should worry everyone.
* **No audio evaluation.** Headless Chromium produces no sound. Dimension 8's
  score leans on source reading and the visual atmosphere only.
* **No long-session data.** Nothing here measures whether hour two is fun. The
  daily sortie and mission records suggest the architecture is there; nobody has
  tested whether anyone comes back.
* **The turn-rate numbers are from ASSIST/MANUAL/AUTO at 200 m/s at 2500 m.**
  They will differ at other energy states; §6.2 shows how differently.
* **I fixed what I reviewed.** That is a conflict of interest. The post-fix
  numbers in Evidence §11 were produced by the same harness that produced the
  pre-fix ones, and the 11 new tests are the durable check — but a second pair of
  eyes on the v1.9.0 build would be worth having.
