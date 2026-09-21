# v1.6.0 — Implementation Notes, Corrections to the Review, and Frank Feedback

> The four documents beside this one were written from the playtest **before** the code was changed.
> This one was written **after**. Where they disagree, this one is right. Read it before acting on
> the review's Tier 0-3 blueprints.

---

## 1. What the review got right, what it got wrong

The player's words were the best evidence in the whole exercise, and every symptom was real. The review's
*causes* were a mixed bag. Each claim was checked against the code before any fix was written.

| Review claim | Verdict | What was actually true |
| :--- | :---: | :--- |
| Banking does not turn the jet | **True** | And worse: the orientation basis was not orthonormal (see §2) |
| Pitch clamped at 88°, no loops | **True** | `AircraftPhysics.ts:155`; now folded through vertical |
| Scope is an RWR with no carrier/bandits/objective | **True** | Now a heading-up tactical radar |
| Instant cut to the deck on death | **True** | Now a 2.6 s slow-motion sequence naming the killer |
| Enemy guns hit-scan from astern with no warning | **True** | 0.7 s aim time, `GUNS TRACKING`, 60% hit chance |
| "Zero contextual hints exist" | **False** | `Tutorial.ts` had a priority-ranked coach ticker; it lacked *attack* prompts |
| "SAM launch never mentions chaff" | **Half** | The banner did; the ticker said something else. Two contradictory instructions |
| "Make the Arcade HUD the default" | **Already so** | `hudDensity = 'ARCADE'` |
| "Add a rookie training sortie" | **Already exists** | `TRAINING_SORTIE`, shielded, with a real drone |
| "The only terrain is a trench" | **Partly** | `OPEN_SEA` and `SHATTERED_RIDGE` exist; FJORD is only the default |
| "Scores regressed by 1.88" | **Misleading** | No code got worse. New player evidence was weighted in |
| Fix: `turnRate = g·tan(φ)/V` | **Wrong** | ~4°/s at 250 m/s (a full circle in ~90 s); flips sign past 90° of bank; doubles the autopilot's rudder |

## 2. The defect nobody had found

A ten-line probe ("bank right for five seconds, print the velocity") showed the jet curving **left**.
`AircraftPhysics.upVector` — and the renderer's `basisVectors`, which duplicates it — used the roll-left
sign for `up` and for two components of `right`, and the roll-right sign for `right.y`.

```
right · up  =  -sin(2·roll)        (should be 0)
at 46° right bank:  right = (0.70, -0.72, ...)   up = (-0.72, 0.70, ...)   ← up ≈ -right
```

Lift acts along `up`, so lift pushed the jet toward the *low* wing's opposite side, and the cockpit camera,
which projects onto the same vectors, was sheared. Nobody saw it because the tests compared the basis
with itself and roll was small in ordinary flight. It is fixed once, asserted orthonormal at arbitrary
attitudes, and the camera is asserted to tilt the horizon the right way in both banks.

## 3. What shipped

Turning (correct lift + body-rate pitch + directional stability + a turn assist with an alpha limiter and a
75° bank cap), loops (fold through vertical), the tactical radar, the death sequence, fair guns, attack
coaching, first-time milestones. Details: [`CHANGELOG.md`](../../../CHANGELOG.md),
[`KNOWLEDGE.md` §19](../../KNOWLEDGE.md), [`KNOWN_ISSUES.md` #49-#59](../../KNOWN_ISSUES.md).

Measured through the real game loop (not in a unit test): about **9°/s** from a held bank, a sustained
**180° in ~19 s** at full afterburner. That is a large change from 0°/s and still not snappy — see
Known Issues #56.

## 4. What was deliberately not done

- The FJORD layout (balanced against its scenarios).
- A new "first sortie" mission (the training sortie exists; the missing piece is a debrief reward).
- Altitude on the radar, a guns-lock tone, a switch for the turn assist.

## 5. Frank feedback

These are opinions, offered because you asked for them.

**On the process that produced the review**

1. **A review written from a symptom list, before opening the code, will confidently invent causes.** This
   one cited line numbers and formulas, and five of its claims were stale or wrong. The line numbers
   made it *look* verified. Insist that a review distinguish "the player said" from "I confirmed in
   code" — and that anything it proposes as a fix comes with the measurement that motivated it.
2. **You have a test suite that proves the maths and no test that proves the game.** 874 passing tests
   coexisted with "the jet can only go north". The gap is not more unit tests; it is a handful of
   *player-verb* tests: hold a key in the running loop and assert the outcome a player would name
   (it turned, it fired, it landed). Two of those found a bug in this release that no unit test could.
3. **"Zero dependencies" and "874 tests" are engineering trophies, and you have been showing them to
   players.** Nobody who plays a flight game for three minutes cares. The README opens with them. The
   first thing a visitor should learn is what they will *feel*.

**Where I would push back on you**

4. **"Only one screen style" was right, and you already did it in v1.5.0 — but the review kept
   recommending it.** Reviewing against a stale picture of the game is a cost you pay every round. Give
   the reviewer the running build, not the description.
5. **"Make it simple" and "keep the retro look" pull against each other more than you admit.** The
   phosphor CRT is the selling point *and* a large part of why the screen is hard to read. I resisted
   simplifying it further; if the next playtest still says "too much on screen", the answer is fewer
   instruments by default, not a cleaner font.
6. **You asked for a release and a deploy in the same prompt as a design task.** That is fine for a
   small change and risky for a physics change: a wrong sign in the flight model ships to everyone at
   once. I would keep the deploy but add one gate — you fly it for ten minutes first.

**Opposite thinking**

7. *You want the beginner to win.* Consider the opposite: the beginner should **lose beautifully**. The
   death sequence in this release helps more than any extra reward would, because a player who
   understands why they died tries again; a player who was handed a win does not know what they learned.
8. *You want less complexity.* The turn assist added a layer of physics. That is the right kind of
   complexity: it is invisible when it works and it is off in the raw model. The wrong kind is a
   setting the player must find. Prefer hidden help to visible options.

## 6. How to improve this kind of prompt

Your prompt is good at intent and weak at *verifiability*. Concrete changes:

- **State the player verb and the pass criterion**, not the feature. Instead of "the radar is not clear",
  write: *"A first-time player can point to the carrier on the radar within five seconds."* You can then
  test that, and so can the agent.
- **Say what must not change.** "Keep the retro look", "keep the fjord" — say them as constraints in a
  list, so they are not re-litigated (this release almost re-opened the fjord).
- **Split "review" from "build".** One prompt that reviews, extends, documents, commits, releases and
  deploys gives the agent no natural checkpoint. Review first, read it, then build. The corrections table
  above exists because the two were separate steps.
- **Ask for numbers.** "Improve turning" → "a held bank should turn at least 8°/s; a 180° in under 15 s."
  The agent measured 9°/s and 19 s and said so; a target would have made the gap a decision rather than a
  footnote.
- **Give the agent a real playtest artefact** (a recording, a screenshot, a save) alongside the words.
  The words were excellent; a five-second clip of the jet flying north would have shown the wrong-way
  bank in a minute.
- **Drop the mention of model names and "you are an experienced game developer".** They change nothing;
  the checklist does.

## 7. Suggested prompt for the next round

```markdown
Player evidence (verbatim): <paste>.
Pass criteria (must be true after your change, each with a test that drives the real GameLoop):
  1. Holding a bank key for 8 s turns the jet >= 70 degrees.
  2. A first-time player can name the carrier's bearing from the radar in 5 s.
  3. Every loss shows its cause for >= 2 s before the deck.
Do not change: the retro phosphor look; the FJORD layout; the raw physics (turnAssist = 0).
First: verify each claim in the existing review against the code and list what is stale or wrong.
Then: implement. Then: report measured numbers, not "improved".
Stop before committing; I will fly the build for ten minutes and then say "release".
```
