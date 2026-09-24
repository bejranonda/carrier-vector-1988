# Standardized Game Review Protocol — 12 Dimensions

> **Purpose:** The evaluation framework for new versions of **Carrier Vector: 1988**.
> **Directory convention:** `docs/reviews/v<Version>/`.
> **Audience:** designers, QA, and autonomous AI development agents.

---

## Why this was cut from 25 dimensions to 12

The framework grew 10 → 12 → 15 → 21 → 25 across five reviews, in direct
violation of the repo's own standing rule #8. The v1.9.0 review cut it back.

The reason is not tidiness. A 25-dimension rubric produced 3,438 lines of review
across 20 files, and **none of it noticed that four pairs of HUD elements were
being drawn into the same rectangle on every frame** — because every dimension
got a thoughtful paragraph and nothing got a measurement. Breadth was purchased
with depth, and the thing that finally found the defects was twenty minutes of
Playwright screenshots.

**Twelve dimensions, each of which must be backed by a number or a screenshot.
Adding one requires removing one.**

**v1.11.0 note:** asked to reconsider whether "fun" deserved its own
dimension, the answer was no — folding a required stuck-time/fun-density
metric into dimension 5's existing evidence (below) cost zero dimensions and
answers the same question a new one would have. Still twelve.

---

## Review Metadata

* **Evaluated version / commit:** `vX.Y.Z` / `<sha>`
* **Date & reviewer:**
* **Build tested:** live deployment URL, or `npm run build && npm run preview`
* **Viewports tested:** minimum one desktop + one phone
* **Test suite:** `N passed / M failed`
* **Typecheck:** clean / failing
* **Bundle:** `X kB raw, Y kB gzip`

---

## 0. Player Evidence (MANDATORY — fill in first)

> **Outranks everything below it.** In v1.5.0, three verbatim sentences from one
> human found more real defects than the entire preceding review suite. In
> v1.9.0, two sentences did it again. Code reading finds *what is*; players find
> *what hurts*.

**Verbatim confusions** — do not paraphrase, do not tidy the grammar:

```
1. "..."
2. "..."
```

| # | Player said | Misunderstanding, or real defect? | Evidence (`file:line` or screenshot) |
| :-: | :-- | :-- | :-- |
| 1 | | | |

> If this section is empty, say so at the top of the review and down-weight every
> conclusion. **Never invent player experience.**
>
> If most confusions turn out to be missing features rather than
> misunderstandings, stop reviewing and start building.

---

## 0b. Rendered-Frame Evidence (MANDATORY — standing rule #12)

> A review without a rendered frame is not a review.

Run the live build in a real browser. Screenshot every distinct screen: boot,
briefing, deck, cockpit (clean), cockpit (under threat), help overlay, debrief.
Repeat at phone size. **`npm run playtest`** (`scripts/playtest.mjs`) does the
first-session path at 7 viewports/sessions and writes every frame plus a JSON
report to `playtest-output/` - start there and extend it for what it does not
cover.

| Screen | Viewport | Elements drawn | Overlaps found | What a beginner would not understand |
| :-- | :-- | :-: | :-: | :-- |
| | | | | |

**Overlap check:** for every pair of HUD elements, state the y-ranges and confirm
they are disjoint. `HudLayout.bottomStackRects()` and `HUD.bandRects()` exist for
exactly this; use them, and add a test for anything they do not cover.

---

## The 12 Dimensions

Each needs a **score /10** and at least one **number or screenshot**. A
dimension supported only by prose is marked `unverified`.

### 1. First five minutes
Time from page load to the first action that feels like flying. Count the
discrete items a beginner must read before that moment. Does anything on screen
contradict anything else on screen?

### 2. Screen legibility
Element count per frame. Overlapping pairs (must be zero). Smallest readable
font. Is there an attitude reference in the *default* HUD mode?

### 3. Control feel
Measured input→response: sustained turn rate (°/s), time for a 180° reversal,
roll onset time, throttle behaviour with no player input. Does the game's own
control reference describe what actually happens?

### 4. Micro-loop — the 0–5 s beat
Aim, lock, fire, hit confirmation, kill feedback. Is a hit distinguishable from
a miss? Does a kill feel like anything?

### 5. Mission & session structure — the 30 s–15 min beat
Objective clarity, phase pacing, win/lose legibility, session length against
stated duration. **Added in v1.11.0, required:** the longest stretch a
hands-off pilot (no input) and a compliant pilot (does only what the on-screen
objective says) each go with no change in what the game is telling them — a
long stall here is stated the same way a defect anywhere else is, with a
number and a screenshot, not just noted in prose.

### 6. Retention & meta
What persists between sessions, what brings a player back tomorrow, what a
returning player sees that a new one does not.

### 7. Deck loop (macro strategy)
Is there a real decision here, or a progress bar? Do the numbers shown change
anything the player will experience in the next five minutes?

### 8. Art, audio & atmosphere
Does the fantasy land? Procedural audio quality, phosphor/CRT fidelity, camera
and impact feedback.

### 9. Narrative voice & writing
Briefing prose, radio callouts, log lines, loss conditions, debrief copy.

### 10. Engineering quality
Test count and coverage of player-facing behaviour, typecheck, dependency count,
bundle size, frame timing. **Note specifically whether any test asserts a
property the shipped game does not actually have under real play conditions.**

### 11. Accessibility & platform reach
Colour-blind palette, reduced motion, flash safety, touch layout, small
viewports, keyboard-only operation. Compare desktop against phone honestly — if
the phone build is clearer, say so.

### 12. Docs vs. code honesty
Pick every factual claim in `CHANGELOG.md`, `README.md` and `KNOWN_ISSUES.md`
touched by this release and verify it against source. Report each as
**true / stale / false**.

---

## Required Output Structure

```
docs/reviews/v<Version>/
├── README.md                                  # Suite index, headline numbers
├── PLAYTEST_EVIDENCE.md                       # Measurements only, zero opinions
├── COMPREHENSIVE_GAME_REVIEW.md               # Scores, good vs. bad, central critique (≤400 lines)
├── RECOMMENDATIONS_AND_ROADMAP.md             # Ranked by impact / LOC
└── FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md # Blunt feedback, opposite thinking, prompt critique
```

**Separating evidence from opinion is not optional.** An AI agent acting on the
review needs facts it can trust without re-deriving them; a human arguing with
the review needs to see which parts are judgement.

---

## Scoring

* **Engineering & Craft** = mean of dimensions 10, 11, 12
* **Player Experience** = mean of dimensions 1–9
* **Composite** = 0.35 × Engineering + 0.65 × Player

Player experience is weighted higher because it is the thing the game is for.

---

## Checklist before publishing

- [ ] §0 Player Evidence contains verbatim quotes, or explicitly says it does not
- [ ] §0b contains real screenshots from a real browser (rule #12); `npm run playtest` passes
- [ ] Every finding cites `file:line` or a screenshot, or is marked `unverified`
- [ ] Every dimension has a number, not just prose
- [ ] Recommendations sorted by player impact ÷ lines of code (rule #9)
- [ ] More deletions proposed than additions (rule #13)
- [ ] Review states which findings were fixed and which were not, and why (rule #14)
- [ ] Framework still has 12 dimensions (rule #8 — one out for every one in)
- [ ] Comprehensive review ≤ 400 lines (rule #11)
- [ ] Registry row added to [`README.md`](README.md)
