# Carrier Vector: 1988 — v1.10.0 Review

**Build:** `v1.10.0` · **Date:** 2026-09-23 · **Framework:** 12 dimensions
([`../REVIEW_TEMPLATE.md`](../REVIEW_TEMPLATE.md)) · **Evidence:**
[`PLAYTEST_EVIDENCE.md`](PLAYTEST_EVIDENCE.md)

---

## 0. Player Evidence — none new

**No new human has played this build.** Every score below comes from
instrumented measurement and screenshots, by the same agent that built the
changes. That is a real conflict of interest and a real limit: the v1.9.0 human
evidence (*"a lot of info on the screen"*, *"hard to control the jet"*) is what
this release answers, but whether it *does* answer it is something only a
beginner can say. Confidence in the player-facing scores is down-weighted
accordingly. The feedback link on every menu screen exists to fix this.

---

## 1. Scores

| # | Dimension | v1.9.0 | v1.10.0 | Why it moved |
| :-: | :-- | :-: | :-: | :-- |
| 1 | First five minutes | 6.0 | **7.5** | FIRST_FLIGHT HUD, 4-panel brief deck, no false hints or alarms, a WINGS moment at the end |
| 2 | Screen legibility | 7.0 | **8.5** | 3 optional regions for a new pilot (was 9); every clickable rect now equals its drawn rect |
| 3 | Control feel | 5.5 | **7.5** | Nose tracks the flight path; 12.3 °/s held-bank turn (was 7.2 with the nose climbing); burner auto-cancels; WASD by position on any layout |
| 4 | Micro-loop | 6.0 | **6.5** | Guns-tracking tone; missile caret says which way to break |
| 5 | Mission structure | 7.5 | 7.5 | Unchanged |
| 6 | Retention & meta | 7.5 | **8.0** | First win is now an event; returning pilots open on the recommended mission |
| 7 | Deck loop | 3.5 | **4.5** | Off the beginner's path; the magazine now actually constrains the loadout (it did not) |
| 8 | Art, audio, atmosphere | 8.5 | 8.5 | Unchanged (headless — no audio evaluation) |
| 9 | Writing | 8.5 | 8.5 | Compass-dependent lines rewritten for the cue-based HUD |
| 10 | Engineering | 9.0 | **9.5** | 989 tests; the browser harness is checked in; the loop survives a bad frame |
| 11 | Accessibility & reach | 7.5 | **8.5** | Touch chaff + HARM; AZERTY/QWERTZ/Dvorak; crash screen; versioned feedback |
| 12 | Docs vs. code honesty | 8.0 | **8.5** | Every claim in this suite is a measurement; stale README claim corrected in v1.9.0 |

| | v1.8.0 | v1.9.0 | **v1.10.0** |
| :-- | :-: | :-: | :-: |
| Engineering & Craft | 7.00 | 8.17 | **8.83** |
| Player Experience | 5.94 | 6.67 | **7.44** |
| Composite (0.35 / 0.65) | 6.31 | 7.20 | **7.93** |

---

## 2. What is good now

* **The first screen a new pilot flies with has three optional things on it**,
  not eleven, and none of them overlap. The compass and radar are replaced by a
  single chevron that says `BOAT 4.2 KM · TURN LEFT`.
* **The jet flies the way it looks.** The nose used to sit 43° above a
  descending flight path in a held bank. That was a physics defect — stability
  acting about the wrong axis — and fixing it removed the "I pull and nothing
  happens" experience at its root.
* **The recovery assist works.** It hands over on the glideslope to within a
  metre, at on-speed AoA. Before, it rode 34 m low on one airframe and flew into
  the sea on the other.
* **The game tells the truth about its own state**: no free bombs, no red
  "FIGHTER" on the training range, no TERRAIN alarm on a normal climb, no two
  orders at once.
* **It fails visibly.** A crash is a recovery screen with a pre-filled report,
  not a frozen image.

## 3. What is still weak

* **Nobody has played it.** See §0. This is the single biggest risk.
* **The deck loop is still shallow** (4.5). It is out of a beginner's way now,
  which is the right first move; making it interesting is design work.
* **SIM is the neglected tempo.** Its airframe cannot make a level hard turn and
  its approach speed has to be clamped below its own on-speed speed (#82).
  ARCADE is the default and the good one; SIM needs its own pass.
* **The briefing is still dense** — six missions, three cards, eight secondary
  options. The FIRST_FLIGHT treatment has not reached it.
* **Audio is unreviewed** — the harness is headless.

## 4. What I would cut next (standing rule #13)

1. **Four of the eight briefing secondary options** for a player on
   FIRST_FLIGHT: pacing, threat level, palette and stick flip are all
   reachable from the help overlay and are now offered in context where it
   matters (the stick flip, by the struggle detector).
2. **The daily-sortie banner for a pilot who has never flown.** It is the first
   thing read on the first screen, and it is a returning-player feature.

## 5. Limits of this review

Scored by the implementer, with no human playtest, no audio, and no long-session
data. The harness proves the promised behaviour happens; it cannot prove it is
fun.
