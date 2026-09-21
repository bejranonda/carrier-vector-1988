# Frank Suggestions, Opposite Thinking & Prompt Guidelines — v1.5.0-dev

> You asked to be told honestly, to be blamed, and to hear the opposite view.
> This document takes that seriously. Nothing here is softened. If any of it is
> wrong, it should be easy to argue against — that is the point of writing it
> plainly.

---

## Part 1 — Frank Critique of the Process (not the code)

### 1.1 You are writing about the game far more than you are playing it

The numbers:

| Artefact | Size |
| :--- | :--- |
| `README.md` | 39,630 bytes |
| `docs/reviews/` (before this one) | ~1,000 lines across 8 files |
| `docs/` total | 9 files |
| Tutorial key correctness | **wrong in 4 places** |
| New players routed to the tutorial you built | **zero** |

You have a 12-dimension framework, upgraded to a 15-dimension framework, with
three review suites, roadmaps, "AI master prompts", and a standard operating
procedure for conducting reviews. And the one mission designed to teach
beginners tells them to press `[A]` for autopilot, which rolls the aircraft into
the sea.

**Blunt version: the reviewing has become the hobby.** It is more comfortable to
produce a beautifully structured 15-pillar evaluation than to sit down, fly the
tutorial once, and notice in eight seconds that the key is wrong. One human
playtest — the one you actually did, that produced your three questions — found
more real defects than the entire v1.4.0 review suite did.

**That is the most important sentence in this document.** Your three
"I don't know how to..." questions were worth more than 958 lines of AI review,
because they came from a human hitting reality.

### 1.2 Your review framework has a false-precision problem

The v1.4.0 review scores the game at **8.85 / 10 (Tech)** and **6.32 / 10 (Player)**.

Those are not real numbers. There is no measurement procedure that distinguishes
8.85 from 8.7. Two decimal places on a subjective judgement is a way of *sounding*
rigorous, and it quietly discourages argument — it is hard to push back on 8.85,
easy to push back on "good, but".

I have continued the convention in this review because consistency across
versions has some tracking value. **But you should consider killing it.** A
three-band scale (`SHIP IT` / `NEEDS WORK` / `BROKEN`) per dimension would be
more honest and would force prioritisation, which decimals actively prevent.

### 1.3 Reviews are not your bottleneck; execution sequencing is

Look at the pattern across three versions:

* **v1.3.0 review** flagged onboarding failure (Issue #32).
* **v1.4.0 review** flagged the "Rookie Onboarding Trap (`DEFAULT_SCENARIO` SAM ambush)".
* **v1.5.0-dev (this review):** new players are *still* routed into the SAM ambush, and the fix is **one line**.

Meanwhile, between those reviews, the project shipped a padlock camera, time
rewind, camera shake, explosion debris, a cockpit voice system, and pointer
interactivity.

**You keep building the interesting thing instead of the important thing.** Every
one of those features is good. None of them matter to a player who quits at
second 40 because a missile they never saw killed them while they were still
figuring out which way is up.

The reviews were right. They were just not *acted on in order*.

### 1.4 Your git hygiene is putting your best work at risk

Eleven modified files and three untracked files are sitting uncommitted,
including `PointerInteractivity.ts` — a brand-new module that addresses the
loudest complaint in the previous review — and the pitch-inversion toggle that
directly answers your own Question 3.

**These are the two best usability features in the project and they exist in one
directory on one machine.** Commit them today. A feature that is not in git does
not exist.

### 1.5 The credit you are due

So that the above is not mistaken for a hatchet job: **the engineering here is
genuinely better than most commercial indie games.** 809 passing tests, zero
runtime dependencies, correct aerodynamics derived from first principles, and
code comments that explain the reasoning behind constants. `Controls.ts` as a
single source of truth that generates its own README table is a pattern I would
recommend to professional teams.

You are not a weak developer with a documentation habit. You are a strong
developer who has let documentation become a substitute for player contact. That
is a much easier problem to fix, and it is fixed by watching someone play.

---

## Part 2 — Opposite Thinking (arguing against my own recommendations)

You asked for the opposite view. Here it is, honestly held.

### 2.1 Against my own framework expansion: 21 dimensions is probably too many

I just added six dimensions to your framework, taking it to 21. **I think that
may be a mistake, and you should consider rejecting it.**

A 21-dimension rubric produces a very long document in which everything scores
somewhere between 4 and 9, and no single number screams. It creates the *feeling*
of thoroughness while making prioritisation harder, because 21 mediocre scores
look like 21 equally valid work items. Your v1.4.0 review scored 15 dimensions
and still did not cause the one-line onboarding fix to happen.

**The opposite proposal: cut the framework to five questions.**

1. Can a new player have fun within 60 seconds, without reading anything?
2. When something threatens the player, can they *do* something about it?
3. Does the game ask for anything the player lacks a tool for?
4. When the player fails, do they know why?
5. Is it still fun on the fifth sortie?

That is the whole review. Everything in my 21 dimensions collapses into those
five, and unlike the 21, these are answerable by watching one person play for
ten minutes. **Keep the 21-dimension version as a deep-audit tool used once per
major version; use the five questions every week.**

### 2.2 Against adding features: you may need to cut, not add

My roadmap proposes flares, a HARM, cruise-missile calls, post-mortems, and an
attract loop. **The opposite view is that this game's problem is already too much
game.**

Count what a new player faces: six missions, three threat levels, three flight
assist modes, three display modes, two HUD densities, two pacing modes, two
palettes, three control modes, time rewind, terrain following, recovery assist,
padlock camera, deck fuel/ordnance triage, crew stamina, bay-door EMCON, and 40+
keybindings. **That is more configurable surface area than most commercial
flight sims ship with.**

A credible alternative roadmap is: **delete half of it.** Ship one mission, six
keys, one HUD, no modes. Make *that* excellent. A tight 10-minute experience
that 100% of players finish beats a 15-system simulator that 90% of players quit
in the first minute.

I do not think this is the right call — the deck-operations layer in particular
is too good to cut — but I want it on record that "add flares and a HARM" is not
obviously correct, and "cut six systems" is a serious competing strategy. If you
only have time for one, **cutting is cheaper and the retention gain may be
larger.**

### 2.3 Against my Q3 answer: maybe your default is right and the convention is wrong

I told you the genre convention is `ArrowUp = nose down`, and that your default
contradicts it. That is factually true.

**But here is the argument against changing it:** your game is a *browser* game
with a vector-arcade aesthetic, played mostly by people who will never touch
DCS. For that audience, "up = climb" is more intuitive, not less. The flight-sim
convention is muscle memory for a small, self-selected population — which
includes you, which is why the question arose.

So the correct fix may not be "change the default" but **"ask the question and
never assume"** — which is what T3-1 proposes. Note the important consequence:
if you ask, the default stops mattering, and the entire debate dissolves. **When
a design argument is hard to settle, that is usually a signal to make it a
player choice rather than to win the argument.**

### 2.4 Against the AI-review loop itself

Be careful of the shape this project is taking: AI writes the code, AI reviews
the code, AI writes the roadmap, AI implements the roadmap, AI reviews the
result. There is a closed loop here with **no reality in it.**

This document is itself part of that loop, and it inherits the same weakness. I
read the source and reasoned carefully, but **I did not fly the aeroplane.** I
cannot tell you whether the stall feels good, whether the CRT bloom is beautiful
or nauseating, or whether trapping on the deck is satisfying — and those are the
things that decide whether the game is any good.

**Every finding in this review that I am most confident about came from your
three human questions, not from my code reading.** That ratio should worry you,
and it should tell you where to spend your next hour: not on another review, but
on giving the build to five people and saying nothing while they play.

---

## Part 3 — Improving Your Prompts and Instructions

You asked for feedback on the prompt itself. It was a good prompt — the "Frank
Suggestion" and "Additional Comment" sections are what made this review useful.
Here is what worked, what did not, and what to use next time.

### 3.1 What worked well (keep these)

* **"Additional Comment" with your three real confusions.** This was the single
  best part. Concrete player friction beats any abstract instruction. It gave
  the review a spine and produced three verified defects.
* **"You can comment and blame me."** Explicit permission to be critical
  materially changes output quality. Most reviews are hedged because the model is
  guessing at tolerance. Keep this in every review prompt.
* **"Think opposite to me."** This forced Part 2, which is where the most useful
  strategic disagreement lives.
* **Asking for systematic documentation.** Version-foldered, registry-indexed
  reviews are genuinely good practice and will compound in value.

### 3.2 What worked against you (change these)

**"Consider to suggest to add more topics or more dimensions."**
This instruction only pushes one way. It guarantees the framework grows every
review and can never shrink, which is how you got from 10 to 12 to 15 pillars.
**Replace with:** *"Suggest dimensions to add AND dimensions to remove or merge.
The framework must not grow unless something is cut."*

**"give scores, also separated by categories"**
Requesting scores invites the false precision criticised in §1.2. **Replace
with:** *"Rate each dimension SHIP IT / NEEDS WORK / BROKEN, and name the single
worst one."*

**"Review by considering ... many dimensions"**
"Many" is an invitation to pad. Reviews optimised for breadth cover everything
and prioritise nothing. **Replace with:** *"Find the three things most likely to
make a player quit in the first two minutes. Ignore everything else."*

**No constraint on cost or sequencing.**
You asked what to improve but never what it costs or what order to do it in — so
previous reviews returned flat lists where a one-line fix sat beside a quaternion
rewrite with equal weight. That is precisely why the one-line fix never happened.
**Always require effort estimates and a strict ordering.**

### 3.3 A better prompt for the next review

Copy-paste this for v1.6.0:

```
# Game Review — v<X.Y.Z>

## Ground rules
- Read the code. Cite file:line for every claim. If you cannot cite it, say
  "unverified" rather than asserting it.
- Be blunt. Assume I can take it. Blame me by name where the process is at fault.
- Argue against your own top recommendation in a dedicated section.
- Do not grow the review framework unless you also cut or merge something.

## Player evidence (most important section)
<Paste verbatim confusions from real playtesters. If empty, say so and
 down-weight your confidence accordingly — do not invent player experience.>

## Required output
1. THE THREE THINGS most likely to make a new player quit in the first two
   minutes, ranked, each with file:line evidence and a line-count estimate.
2. Every finding rated SHIP IT / NEEDS WORK / BROKEN. No decimals.
3. A strictly ordered fix list sorted by (player impact ÷ lines of code).
   Cheapest high-impact fix first. Explicitly flag any item that is
   "interesting to build but low player impact".
4. What I should DELETE. At least two items. Cutting is a valid recommendation.
5. What is genuinely good, so I don't regress it.
6. One section arguing the opposite of your main recommendation.

## Do not
- Do not praise the test suite for more than two sentences. I know.
- Do not propose anything over 300 lines unless it is in the top three.
- Do not write more than 400 lines total. If the review is longer than the fix,
  the review is the problem.
```

### 3.4 The instruction you should add to `CLAUDE.md`

The `[A]`/`[F]` bug had a preventable root cause: key names were hardcoded in
mission prose, outside the `Controls.ts` single-source-of-truth guarantee. Add a
standing project rule:

```md
## Control references
Never hardcode a key name in user-facing text. Every key mentioned in a
scenario card, phase detail, hint, or banner must be resolved from
CONTROL_SCHEMA. A test must assert that every key string in Scenarios.ts,
Tutorial.ts and HUD.ts exists in CONTROL_SCHEMA for that context.
```

### 3.5 The habit that beats every prompt

**Before the next review, do this instead:** give the build to three people who
have never seen it. Say nothing. Watch for ten minutes. Write down every moment
they hesitate.

You did a version of this once, and it produced three findings that were all
correct and all actionable. That is a better hit rate than any framework in this
folder has achieved. **The most valuable thing in `docs/reviews/` is not the
21 dimensions — it is your own three sentences of confusion.**

---

## Part 4 — If You Read Only One Paragraph

Spend one hour: change one line so new players reach `TRAINING_SORTIE`, change
`[A]` to `[F]` in four places, and commit the work already sitting in your
working directory. Then spend a weekend giving the SAM missile a turn-rate limit
and adding flares on `[X]`. That is roughly 150 lines of code, and it will move
the player experience further than everything shipped in v1.4.0 combined.
Everything else in this folder — including the rest of this document — can wait.
