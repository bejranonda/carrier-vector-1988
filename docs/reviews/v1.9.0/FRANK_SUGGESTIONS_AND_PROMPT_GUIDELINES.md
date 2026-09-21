# v1.9.0 — Frank Suggestions, Opposite Thinking & Prompt Guidelines

You asked to be told honestly, to be blamed where blame is due, to be argued
with, and to have your own instructions criticised. This document does all four.
It is deliberately blunter than the review. None of it is personal — the project
is good, which is exactly why the honest version is worth more than the polite
one.

---

## 1. The blunt version

**You have been fixing the wrong layer for six releases.**

Every review since v1.3.0 has correctly identified "too much on screen, unclear
what to do". Every release since has responded by **adding a new thing to the
screen**: a coach ticker, an objective strip, a checklist, an annunciator, a
pill bar, four weapon pills, a chaff pill, a rewind pill, a padlock pill, a
status pill, two corner buttons, a bigger radar. Thirteen additions, every one of
them justified, every one of them aimed at making the game *easier*.

The result: **27 simultaneous draw regions, and four pairs of them occupying the
same pixels.** Your mission order was being printed through your compass tape.
Your score was underneath a button. The player who told you "there is a lot of
info on the screen" was describing text literally overlapping other text, and
none of the five previous review suites caught it — because none of them ever
looked at a rendered frame.

**The lesson is not "review harder". It is "run the game and look at it".**

---

## 2. Where I think you are wrong

### 2.1 "Decluttering" by deleting the artificial horizon

`drawPitchLadder` opened with *"In Arcade mode, keep the center of the screen
clean and uncluttered!"* — and returned before drawing the horizon.

This is the most consequential wrong call in the codebase. You removed the
instrument that answers *"why isn't my turn working?"* in the name of helping
beginners. A beginner in a 75° bank with a 36° nose-up attitude and the real
horizon off-screen had **no attitude cue anywhere on the glass**. Your
playtester's second sentence — *"it is hard to understand how to control the
jet"* — is the direct, predictable consequence.

Clutter is not a pixel count. A horizon line is not clutter. A `PADLOCK` pill is.

### 2.2 The training sortie is not a training sortie

`TRAINING SORTIE`, tagline *"Zero combat hostiles"*, took 15% of your carrier's
hull at T+20s while a first-time player read the deck screen. The `combatShielded`
flag existed, was checked in four places, and every one of them protected the
*player's jet* — nobody checked it where the *carrier* takes damage.

But the deeper problem is the design: the mission you route every new player to
is simultaneously telling them "nothing here can hurt you", showing them
`1 INBOUND / FIGHTER 0:18` in red, and spawning a MiG-23 labelled `MiG-23` — not
`DRONE`. Three signals, three different stories. If it is a drone, call it a
drone everywhere.

### 2.3 The deck screen should not be the first screen

You put a beginner in front of eight panels and thirty-five numbers before they
have flown. You know this is wrong, because **you already built the right version
and shipped it on phones**: four panels, one big `LAUNCH` button. It is better.
Promote it. You do not need to design anything — you need to stop treating the
phone layout as the compromise and the desktop layout as the real one.

### 2.4 Six scenarios is more than you can balance

`CARRIER DEFENSE`, `CANYON STRIKE`, `IRON HAND`, `LAST STAND`, `CARRIER QUALS`,
`TRAINING SORTIE`. The deck loop scores 3.5/10 across three reviews and nothing
has been done, partly because effort keeps going into breadth. Three
well-balanced missions with a deck loop worth playing would beat six with one
that is a waiting room.

---

## 3. Where you are right and the reviews were wrong

Fairness matters, and the previous reviews have a documented habit of being
confidently wrong (see `v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md`).

* **Zero dependencies was the right call.** 75 kB gzip, no supply chain, every
  transform inspectable. Keep it.
* **"Hold W to tighten the turn" is correct**, despite feeling wrong in play.
  Measured: 7.2 °/s on bank alone, 9.5 °/s with back-stick. I set out to report
  this as a bug and the measurements said otherwise. Documented in Evidence §6.1.
* **The `START HERE` routing works.** The v1.8.0 changelog claim is true and
  end-to-end wired. I initially misread the constructor and was about to report
  it as a false claim; `GameLoop.start()` does exactly what it says.
* **The prose is a genuine asset.** Do not let anyone talk you into stripping the
  voice out for "clarity". `"The blast doors close in four minutes"` teaches the
  mission better than a diagram.
* **The test discipline is real.** 932 tests caught nothing in §2 because nobody
  had written a test for "do two things overlap" — but the moment one was
  written, it worked. The habit is there; point it at pixels.

---

## 4. Frank feedback on your prompt

You asked for this, so here it is.

### 4.1 What your prompt did well

* **You led with the player's own words**, unpolished. Those two sentences were
  worth more than the entire 3,438-line review archive. Keep doing that — always
  verbatim, never tidied.
* **You asked for scores by category.** Forces commitment instead of vibes.
* **You explicitly invited disagreement.** Without that line this document would
  not exist, and §4.2 certainly would not.
* **You asked for the docs to be systematic and reusable by future AI.** Right
  instinct — that is why the evidence lives in its own file, all numbers, no
  opinions.

### 4.2 What your prompt got wrong

**"Rethink and reconsider to suggest to add more topics or more dimensions."**

This instruction is actively harmful and it directly contradicts your own
repository's standing rule #8:

> *"The framework must not grow unless something is cut. It went 10 → 12 → 15 →
> 21 dimensions across four reviews. A rubric that only grows creates the feeling
> of thoroughness while making prioritisation harder."*

It then grew to 25. Your prompt asked for 26+. **I cut it to 12.** A 25-dimension
rubric is how you end up with 3,438 lines of review that never noticed the
compass tape was printed inside the objective strip — every dimension gets a
paragraph, nothing gets a measurement.

**"Review... then update readme, all related files and documents... then commit,
and release as next version" — in one prompt.**

This bundles a diagnosis with a release. It pressures whoever executes it to
*produce documents* rather than *find problems*, because documents are the
visible deliverable. Split it:

1. *"Play the live build and report what is broken, with evidence."*
2. *"Fix these specific things."*
3. *"Update docs and release."*

**You asked for a review; you needed a playtest.** Five suites diagnosed
correctly and changed nothing. The thing that finally moved the needle was
twenty minutes of Playwright taking screenshots.

### 4.3 The prompt I would use next time

> Play the live build at <url> as an absolute beginner, in a real browser, at
> 1440×900 and on a phone. Screenshot every screen. For each screenshot, list
> what a first-time player would be confused by, and cite `file:line` for the
> cause.
>
> Then do only this: find the three cheapest changes, by lines of code, that
> would most reduce that confusion. Implement them with regression tests. Do not
> add any new UI element.
>
> Report in under 200 lines. Do not expand the review framework. Recommend at
> least two things to delete.

Shorter, harder to satisfy with prose, and impossible to satisfy by adding
another pill.

### 4.4 Standing instructions to put in the repo

Added to [`../README.md`](../README.md) as rules #12–#14:

12. **A review without a rendered frame is not a review.** Every review runs the
    live build in a real browser and inspects actual pixels. Source reading finds
    what the code *says*; only a screenshot finds what the player *sees*.
13. **Every review must propose more deletions than additions.** If it proposes a
    new UI element, it must name the one being removed to pay for it.
14. **Fix count beats finding count.** A review that ships three tested fixes
    beats one that catalogues thirty problems. Close the loop or do not open it.

---

## 5. The one thing to do next

Not another review. Not another assist. Build **R1: the `FIRST FLIGHT` HUD** —
horizon, speed, altitude, one objective line, one key hint, nothing else, on by
default until the first sortie is complete.

Every one of those five elements already exists and is already conditional
somewhere in `HUD.ts`. It is a visibility predicate, roughly 150 lines. It is the
smallest change with the largest effect on the exact complaint your playtester
made, and it is the only recommendation in this suite that directly answers
*"I do not know what to do and to start"*.

Then delete the keycap strip. Then promote the phone deck layout.

Three changes. No new features. That is the release that makes this game
approachable.
