# v1.9.0 — Recommendations & Roadmap

> **Status: implemented in v1.10.0 — read
> [`../v1.10.0/IMPLEMENTATION_REPORT.md`](../v1.10.0/IMPLEMENTATION_REPORT.md)
> first.** Four of these recommendations were changed after measurement: R2's
> roll easing was the wrong fix (the cause was a physics defect), R1 gained a
> steering cue because the FIRST_FLIGHT HUD could not simply lose the compass,
> R3 became a burner-only cancel, and R6 was a free-ordnance bug, not a label.

Ranked by **player impact ÷ lines of code**, per standing rule #9 in
[`../README.md`](../README.md). Each item states the reason, not just the
action — a recommendation you cannot argue with is a recommendation you cannot
improve.

**Legend** — ✅ shipped in v1.9.0 · 🔨 ready to build · 🤔 needs an owner decision

---

## Tier 0 — Shipped in v1.9.0 ✅

These were unambiguous defects: small, testable, and no balance decision
involved. All have regression tests.

| # | Fix | Why | Where |
| :-: | :-- | :-- | :-- |
| T0.1 | Derive the top band stack from constants | Objective strip (54–108) and compass tape (76–108) were the same pixels | `HUD.ts` `BAND`, `bandRects()` |
| T0.2 | Derive the bottom band stack | Pill bar, assist annunciator and keycap strip shared one 35 px band | `HudLayout.ts` `BOTTOM_STACK`, `bottomStackRects()` |
| T0.3 | Move the score chip below the button row | Score and rank were printed under `DECK (TAB)` on every desktop frame | `HUD.ts` `TOP_RIGHT` |
| T0.4 | `fitText` the help-overlay labels | Unbounded `fillText` ran FLIGHT labels into SYSTEM keycaps | `BriefingScreen.ts` |
| T0.5 | Horizon bar + signed pitch in ARCADE | The default HUD had no attitude reference at all | `HUD.ts` `drawArcadeHorizon` |
| T0.6 | Trap-speed hint requires a real approach | It fired on every launch, contradicted the objective, and would stall a beginner | `Tutorial.ts`, `GameLoop.ts` |
| T0.7 | `combatShielded` honoured by the deck | The "zero hostiles" tutorial took 15% of the carrier's hull at T+20s | `DeckManager.ts`, `GameLoop.ts` |
| T0.8 | Shorten every control label | Longest was 57 chars and did not fit its own column | `Controls.ts` |

---

## Tier 1 — The big one

### R1 🔨 `FIRST FLIGHT` HUD: show five things, hide the other twenty-two

**Impact: very high. Effort: ~150 LOC. This is the answer to the review.**

The player said there is too much on screen. The answer is not another assist —
it is a screen with less on it. Add a third HUD density *below* ARCADE, default
it on until the player has completed one sortie, and put exactly this on it:

```
  horizon bar + pitch number          (already built — drawArcadeHorizon)
  airspeed                            (already built)
  altitude                            (already built)
  the objective strip                 (already built)
  ONE contextual key hint              (already built — the coach ticker)
```

Everything else off: no compass tape, no RWR scope, no pill bar, no keycap
strip, no score chip, no annunciator, no top-right buttons. One line in the
briefing: *"Full instruments: press `U`."*

**Why this and not more tutorial:** every element already exists and is already
conditional somewhere. This is a visibility predicate, not new UI. And the
project has already proved the approach works — the phone build does exactly
this and is the clearest version of the game that ships (Evidence §8).

**Implementation sketch.** `hudDensity` becomes `'FIRST_FLIGHT' | 'ARCADE' |
'PRO'`; `HUD.draw` guards each non-essential draw with
`if (this.hudDensity !== 'FIRST_FLIGHT')`; persist the graduation flag next to
the existing `MissionRecords`. Test: assert the FIRST_FLIGHT frame issues at most
six draw calls.

---

## Tier 2 — Control feel

### R2 🤔 Turn rate and roll feel

**Impact: high. Effort: ~20 LOC + a full mission-timing re-balance.**

Measured: 7–10 °/s sustained, so a 180° reversal is 17–25 s. Holding `A` snaps to
the 75° cap instantly and pins there — the bank key is effectively a toggle.

*This is deliberately not changed in v1.9.0.* Turn rate is the single number
every mission's timing budget is built on; changing it is a design decision, not
a bug fix. But it is the mechanical root of *"hard to control the jet"*, so the
owner should decide:

* **Option A (recommended): keep the physics, fix the feel.** Ease the roll to
  the cap over ~0.4 s instead of snapping, so the bank has weight and the player
  can hold an intermediate angle. `AircraftPhysics.applyRollInput`, ~8 lines.
  Changes no mission timing.
* **Option B: raise the arcade turn rate to ~18 °/s** (180° in 10 s) under
  ARCADE pacing only, leaving SIM pacing alone. Requires re-checking every
  scenario's clock. ~10 lines plus balancing.
* **Option C: do nothing**, and treat 20-second reversals as the intended
  heavy-jet fantasy. Defensible — but then the tutorial must *say* so, because
  right now a beginner reads it as broken input.

### R3 🔨 Retard the throttle when the anti-stall floor is no longer needed

**Impact: medium-high. Effort: ~10 LOC.**

`FlightAssist.ts:393` raises throttle to 0.7 when airspeed decays below 130 m/s,
and nothing ever brings it down. Measured: a new pilot sits at **150% afterburner
for the entire sortie** without touching a key, which is what drives the nose-high
energy state in Evidence §6.2 and burns 138 L in 25 s.

Symmetrical fix: in `ASSIST`, when airspeed exceeds ~200 m/s and the pilot is not
commanding throttle, ease the demand back toward ~0.85. Same shape as the floor
that already exists.

### R4 🔨 One instruction at a time

**Impact: medium. Effort: ~15 LOC.**

Evidence §3 caught the objective strip, the coach ticker and a contact tag
issuing three different orders in one frame (`CLIMB` / `REDUCE SPEED` /
`TURN RIGHT`). `HUD.draw` already suppresses the coach ticker when it duplicates
a warning banner — extend that arbitration: while the objective strip carries an
`ACTION` urgency, the coach ticker shows only `CRITICAL` hints.

---

## Tier 3 — The deck screen

### R5 🤔 Promote the phone deck layout to the default everywhere

**Impact: high for beginners. Effort: ~40 LOC (the layout already exists).**

The desktop deck screen is 8 panels and ~35 numbers; the phone deck screen is 4
panels and one big `LAUNCH` button, from the same code. The phone version is
better for a first-time player on any device.

Proposal: `DeckView` takes a `detail: 'BRIEF' | 'FULL'` flag. `BRIEF` uses the
phone panel set (`ORDERS`, `TURNAROUND`, `THREATS`, plus the launch button) at
any viewport size. Default `BRIEF` until the player has flown one sortie; `TAB`
or a corner button reveals `FULL`.

This is the single cheapest large improvement available, because the hard part —
a panel solver that sheds panels by priority — is already written and tested in
`DeckLayout.ts`.

### R6 🔨 Fix the two contradictions on the deck screen

**Impact: medium. Effort: ~15 LOC.**

* `NEXT SORTIE PAYLOAD` offers `MK.82 IRON BOMB 2 / 4` while stock is `0`. Clamp
  the planned loadout to what the ship actually has, and grey out what it cannot
  supply.
* `EARLY WARNING RADAR` labels the training drone `1 INBOUND / FIGHTER 0:18` in
  red on a mission whose briefing promises zero hostiles. In a `combatShielded`
  scenario, label it `TARGET DRONE` in the neutral colour. (`DeckManager` already
  knows — `combatShielded` is on it since v1.9.0.)

### R7 🤔 Give the deck one real decision, or cut it to a button

The deck loop scores 3.5/10 and has for three reviews. It is a waiting room with
a progress bar. Two honest options:

* **Deepen it:** make fuel-versus-ordnance a decision with teeth — a heavy jet
  that genuinely cannot make the merge, a light one that cannot reach the target.
  Requires the payload to visibly change flight performance in a way the player
  can *feel*.
* **Cut it:** if the deck is not going to be interesting, stop making it the
  first screen a beginner sees. R5 is the cheap version of this.

Half-measures have been tried for three releases. Pick one.

---

## Tier 4 — Deletions (standing rule #10)

| Cut | Reason | Saves |
| :-- | :-- | :-- |
| The keycap cheat strip (`drawKeyBar`) | Duplicates the help overlay *and* the pill labels; was half of the bottom-band collision | ~45 LOC, a whole screen band |
| `DECK CREW STAMINA` as its own panel | Four numbers a beginner cannot act on; fold to one line in `TURNAROUND` | a full deck panel |
| Permanent `REWIND 5S` / `PADLOCK` pills | Advertise features most players never press; show them contextually, as the chaff pill already does | 2 pills of permanent furniture |

---

## Tier 5 — Worth building, not urgent

* **`BankToTurn.test.ts` needs the saturated case.** The existing test uses 0.6
  stick for 6 s from 220 m/s, where bank-and-pull is faster. Add the state the
  game actually creates — full deflection, 180 m/s decaying, nose high — and
  assert whatever the intended behaviour *is*. 921 green tests hid this.
* **A first-session telemetry harness in the repo.** The Playwright script that
  produced this review's evidence took twenty minutes to write and found five
  shipped defects that 3,438 lines of prior review missed. Check one in. See
  [`../../APPROACH_AND_METHOD.md`](../../APPROACH_AND_METHOD.md) §"Instrumented
  playtesting".
* **Screen-region budget.** Add a test that fails when the cockpit draws more
  than N regions in ARCADE. It is the only way "we will not add another pill"
  survives contact with the next good idea.

---

## What NOT to do next

1. **Do not commission another review.** Five suites, 3,438 lines, the same three
   findings each time. The diagnosis has been correct since v1.3.0. Build R1.
2. **Do not add another assist, pill, or HUD element** until R1 ships and Tier 4
   is cut. The screen is the problem; adding to it cannot be the solution.
3. **Do not expand the review framework.** It went 10 → 12 → 15 → 21 → 25
   dimensions against the repo's own standing rule. It is 12 now. Keep it there.
