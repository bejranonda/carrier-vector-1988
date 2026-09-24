# v1.10.0 — Implementation Report

**What happened to every recommendation in the v1.9.0 review, and how several
of them were improved before they were built.** Read this before the v1.9.0
roadmap: four of its recommendations turned out to be aimed at the wrong layer
once they were measured.

* **Starting point:** `v1.9.0` (commit `472f468`), 933 tests
* **Shipped:** `v1.10.0`, **989 tests**, **28/28 browser checks**, typecheck clean
* **Bundle:** 246 kB raw / 79.6 kB gzip (+3.8 kB gzip), zero runtime dependencies
* **Evidence:** [`PLAYTEST_EVIDENCE.md`](PLAYTEST_EVIDENCE.md), and `npm run playtest`

---

## 1. Recommendations that were improved before they were built

The instruction was "improve the suggestions if potential, then follow them".
Measuring first changed four of them.

### R2 — "Ease the roll to the cap" was the wrong fix

The v1.9.0 review recommended easing the roll to its 75° cap. Measurement showed
the roll already reaches the cap in ~0.45 s, which is normal arcade feel. The
real cause of *"I bank, I pull, nothing happens"* was two things the review had
not found:

1. **A physics defect.** Directional stability ("weathervane") rotated the nose
   about the **world** vertical axis. Wings-level that is correct; in a bank it
   is wrong, because the airframe's yaw axis is tilted. Nothing pulled a banked
   nose back to the flight path. Measured: 16 s of held bank left the nose
   **43° above the horizon while the jet was descending 146 m** — a huge
   sideslip nothing corrected, and the source of every "climbing spiral".
   *Fixed:* stability now acts on the sideslip angle β about the **body** yaw
   axis. Identical wings-level; correct banked. The nose now tracks the flight
   path (pitch stays within a few degrees).
2. **An under-lifted airframe that contradicted the game's own numbers.** The
   recovery assist flew approaches at 70 m/s and the AoA indexer's on-speed band
   is 8.1° ± 1.2° (the real F-14 value) — but this airframe needed **15.5° AoA**
   for 1 g at 70 m/s, 2.5° from the stall. *Fixed:* the ARCADE tempo flies a
   bigger wing (`liftScale 1.7`, lift **and** drag scaled, so no free energy).
   SIM keeps the original numbers, as its label promises.

Result, measured in the running game with a held `A` key: **12.3 °/s with the
nose at +6°**, versus 7.2 °/s with the nose climbing to 29° in v1.9.0.

### R1 — a FIRST_FLIGHT HUD cannot simply hide the compass and radar

The training sortie's recovery card said *"Turn to heading 180"* — unreadable
without a compass. So the improved R1 replaces both with **one steering cue**: a
chevron on a ring round the boresight pointing at the goal (`BOAT 4.2 KM · TURN
LEFT`), readable at any bank angle. The same ring carries a **red missile caret**
(Known Issues #42), which matters more now that the radar is hidden. It also
closes #54, the "go here" arrow the v1.6 playtest asked for.

### R5 — the deck follows the HUD, rather than getting its own switch

Instead of a separate brief/full toggle, the deck's detail follows the HUD
density: FIRST_FLIGHT → brief deck. `U` is the one "show me more" key everywhere.

### R3 — cancel only the afterburner, and only when it is not earning its keep

A symmetric "retard to 0.85" would have fought pilots who set their own power.
The shipped rule: in ASSIST, **afterburner is a held boost** — released above
180 m/s, it comes back to military power within about a second. A throttle the
pilot set below 100% is never touched. Burner is kept during a hard turn that is
bleeding energy, which is when it is actually useful.

---

## 2. What shipped, recommendation by recommendation

| v1.9.0 item | Status | Notes |
| :-- | :-- | :-- |
| **R1** FIRST_FLIGHT HUD | ✅ Shipped, improved | `core/HudDensity.ts`; one visibility table; graduates on first completed mission; player choice persisted and never overridden |
| **R2** Turn and roll feel | ✅ Shipped, replaced | Body-axis sideslip fix + ARCADE airframe; see §1 |
| **R3** Throttle retard | ✅ Shipped, refined | Burner-only cancel; see §1 |
| **R4** One instruction at a time | ✅ Shipped | `Tutorial.arbitrateHint` — safety always speaks; routine coaching is silent while the objective is a non-attack order |
| **R5** Phone deck layout everywhere | ✅ Shipped, improved | `DeckView.deckPanelSpecs`: BRIEF = orders, turnaround, contacts, log |
| **R6** Deck contradictions | ✅ Shipped, deeper than reported | "Bombs it doesn't have" was a **free-ordnance bug**: launch clamped the ship's stock but handed the jet the full plan |
| **R7** Deck depth | ⏸ Owner decision | R5 removes the deck from a beginner's path; deepening it is design work, not a fix |
| Tier 4: delete keycap strip | ✅ Deleted | Replaced in FIRST_FLIGHT by one line: `U more instruments · H all controls` |
| Tier 4: fold crew panel | ✅ Folded | One `DECK CREW 89%` line in the turnaround panel |
| Tier 4: contextual pills | ✅ Shipped | REWIND only while charges remain; PADLOCK only with a designation |
| Tier 5: saturated turn test | ✅ Shipped | `BankToTurn.test.ts` "coordinated turning (v1.10.0)" |
| Tier 5: playtest harness | ✅ Checked in | `npm run playtest` — 28 checks, 7 viewports/sessions |
| Tier 5: screen budget test | ✅ Shipped | `HudDensity.test.ts` "holds each density to its screen budget" |

---

## 3. Defects found while building (none were in any review)

The review's central lesson — look at the pixels — kept paying out. Each of
these was found by the harness or by measuring, not by reading.

| # | Defect | How it surfaced | Fix |
| :-: | :-- | :-- | :-- |
| 71 | Weathervane on the wrong axis (see §1) | Turn probe | Body-axis β stability |
| 72 | Recovery assist **flew into the sea** on the ARCADE airframe; on SIM it rode 34 m low at 95 m/s and never reached its own speed target | Approach probe | Rate-damped autothrottle; flight-path (γ) damping wings-level; glideslope feed-forward; approach speed derived from on-speed AoA. Now **within 1 m of the slope** on both airframes |
| 73 | Free ordnance from an empty magazine | Deck screenshot | `DeckManager.loadableLoadout()` |
| 74 | The turnaround panel's LOADED rows had **never** been visible on desktop | Deck screenshot | Bar placed under the status text when there is room |
| 75 | Every desktop click on ASSIST / REWIND / PADLOCK landed **104 px left** of the pill | Code read while wiring R1 | Renderer and hit-tester share `arcadeBarFlags` |
| 76 | PRO corner buttons hit-tested at different x than drawn; deleted keycap strip left **invisible click traps** | Same | `cornerButtonRects`, `proChipRects` shared solvers |
| 77 | Red `TERRAIN — AUTO PULL-UP` on every normal catapult climb-out | Harness screenshot | Announce only when sinking or at the hard floor |
| 78 | Phones showed `GET ASTERN OF THE BOAT` from take-off, over `CLIMB TO 2,500 FT` | Phone screenshot | JOIN cue only when homeward |
| 79 | Any exception froze the game on a still frame, silently | Code read | Resilient loop + crash screen |
| 80 | Returning pilots: START HERE on one mission, FLY button on another | Harness screenshot | Always open on the recommendation |
| 81 | Touch HUD readouts drifted into the objective strip once the thumb column grew | Phone screenshot | Anchored to the free bottom-centre gap |

---

## 4. Known issues closed

#40, #41 (layout-independence; a remap UI stays P2), #42, #44, #45, #47 (verified
by a stand-off simulation; a human feel pass is still welcome), #48, #54, #55,
#56, #59, #61, #65, #66, #68, #69, #70, and #71–#81 above. Details in
[`../../KNOWN_ISSUES.md`](../../KNOWN_ISSUES.md).

## 5. Deliberately still open

* **#53 — the fjord is a 1-D corridor.** A branching map is new content with
  scenario re-balancing, not a fix. `OPEN_SEA` and `SHATTERED_RIDGE` exist.
* **R7 — the deck loop is shallow.** Now off a beginner's path; deepening it is
  an owner's design call.
* **SIM approach speed is clamped at 88 m/s** (its on-speed speed is ~100 m/s,
  above what the wires accept), so on SIM the AoA indexer reads slightly slow on
  a correct approach. Recorded as #82; the honest fix is a SIM airframe re-tune.
* **Browser harness is not in the deploy gate.** Its turn-rate check is
  wall-clock based and could flake on a slow CI runner. Run it before a release.
