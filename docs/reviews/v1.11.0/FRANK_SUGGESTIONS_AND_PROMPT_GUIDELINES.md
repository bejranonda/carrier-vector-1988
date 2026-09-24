# v1.11.0 — Frank Notes & Prompt Guidelines

---

## 1. Frank

**This release fixed exactly what was reported, and nothing it wasn't sure
about.** Four sentences named three problems: no menu, no idea what to do,
too many keys. All three were real, all three were measured before being
fixed, and two of the three turned out to be worse than the sentences implied
— the "hard to control" complaint led to a genuine 85°-pitch-and-near-stall
defect in the *default* flight mode, and chasing the recovery assist's
behaviour for "take me home" turned up a bug that flew the jet 7.9 km in the
wrong direction. Neither of those was visible from the four sentences alone;
both came from actually reproducing the complaint in a browser rather than
reading the code and guessing.

**The first fix attempt for "take me home" was wrong, and I caught it by
testing, not by reasoning about it harder.** The obvious fix — teach the
autopilot to fly the join-point route it already uses for a genuinely distant
jet — turned a 640 m recovery into an 11 km, 13,000-ft-altitude loop that
never converged, because that route's turn radius assumes a long transit, not
a course reversal fifty seconds from the boat. The actual fix is a different,
smaller law for exactly that case. **The lesson, again: an assist that has
not been run past its own worst measured input is a plausible story, not a
fix.** This is now the second consecutive release where the first idea for a
flight-assist fix was wrong in a way only a running simulation caught (v1.9.0:
easing the roll instead of fixing the axis defect).

**"Let user have fun to play too" is a real instruction and I want to be
honest about how thin the response to it is.** What shipped: a reward banner
and tone on every training step, and the menu doesn't take the trigger away
from the player even when the autopilot is flying. What did NOT ship: a
ghost-lead autopilot that actually flies the climb rather than just holding
wings level, a trimmed first-time briefing, and a friendlier training-sortie
step. Those are real fun improvements and they were cut for time, not
because they weren't wanted. Tier 3 of the roadmap says so plainly rather
than letting "shipped a reward chime" stand in for "made it fun."

**Nobody new has played this build either, for the third release running.**
The feedback link has existed since v1.10.0 and has zero known uses. At some
point "ship a feedback link" stops being a credible substitute for "use it."

## 2. Where this release was wrong before it was right

* **The first "take me home" fix** (route to the standard join point,
  unconditionally) — see above. Replaced with a distinct, tighter reversal for
  the close-in case, distinguished from the far-out case by re-using
  `inApproachCorridor`'s own position-only test rather than adding a new
  `ApproachPhase` value.
* **An early draft of the pilot-menu default fallback bearing** ("when
  recovery is on and nothing else has a nav target, always aim the generic
  autopilot at the carrier") produced a slow, wide, oscillating orbit around
  the ship instead of a clean approach, for the same turn-radius-vs-distance
  reason as above. Reverted; the fix lives entirely in `ApproachGuidance` and
  `recoveryNav` instead of the generic fallback.

## 3. Feedback on the prompt

**What worked well:** giving the game reviewer persona explicit license to
"blame me" and "think opposite" made it easy to say plainly that a
recommendation (the ghost-lead autopilot) was cut for time rather than
quietly shipping a smaller version and calling it done.

**What to change for next time:**

* **"Give more suggestions to improve the game to entertain the player"** was
  present but arrived as a single line late in the conversation, mid-build.
  Naming it up front, alongside the specific desktop complaints, would have
  let it shape the plan rather than being retrofitted as one more tier at the
  end (Tier 3, R1/R2 here).
* **The dimension-reconsideration instruction** ("rethink and reconsider to
  suggest to add more topics or more dimensions") was answered narrowly this
  round — the 12-dimension framework was kept intact (per standing rule #8,
  which exists precisely because it grew unchecked before) and a "fun
  density" metric was added to dimension 5's evidence rather than as a new
  13th dimension. If a future prompt wants an actual dimension swap, say so
  explicitly — "cut a dimension for fun" — because the standing rule makes
  net addition a real cost, not a free suggestion to accept.
* **"Test, validate, debug"** was, this round, satisfiable and satisfied:
  1,029 tests, `tsc` clean, 33/33 browser checks, a production build that
  loads under the deployed path. Naming that bar explicitly (as the v1.10.0
  frank notes suggested) made "when to stop" unambiguous this time. Keep
  doing that.

**A prompt for the next round**, unchanged from v1.10.0's suggestion because
it was correct and still hasn't been tried:

> Share the live build with five people who have never played it. Collect
> their first-two-minute reactions verbatim through the in-game FEEDBACK
> link. Then: fix only what they hit, in order of how many hit it, with a
> regression test and a harness check for each. Do not add HUD elements.
> Report in under 150 lines.
