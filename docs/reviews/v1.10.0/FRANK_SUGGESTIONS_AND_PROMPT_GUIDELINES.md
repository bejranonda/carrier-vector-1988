# v1.10.0 — Frank Notes & Prompt Guidelines

---

## 1. Frank

**The review's recommendations were half right, and measuring before building
is what saved the other half.** The v1.9.0 review said the turn was the problem
and recommended easing the roll. Measuring showed the roll was fine and the
problem was a physics defect nobody had looked for: stability acting about the
world axis instead of the airframe's. Building the recommendation as written
would have shipped a change that did nothing, and reported success.

**The biggest remaining risk is not in the code.** Two releases in a row have
been driven by one human's two sentences. Everything since has been measured by
a machine and scored by the agent that built it. That is not validation, it is
verification. Ship this to real beginners and read what they say before
touching anything else.

**"Close all issues" is not a goal a codebase can meet, and should not be.**
`KNOWN_ISSUES.md` holds 82 entries. Many are *by design* (the zero-dependency
policy, stereo audio, analytic terrain) or are platform limits (browser audio
autoplay). Closing those would mean either deleting honest documentation or
building things nobody needs. This release closed 17 of them, found and fixed 11
new ones, and left four open with reasons. That is the honest version of the request.

**SIM is being neglected.** Every improvement here landed on ARCADE, the
default. SIM now has a better controller and worse ergonomics than ARCADE. Decide
whether SIM is a product or a museum exhibit.

---

## 2. Where the previous reviews and I were wrong

* **v1.9.0 R2 ("ease the roll to the cap")** — wrong layer; see the
  implementation report §1.
* **v1.9.0 R3 ("retard toward 0.85")** — would have fought pilots who set their
  own power. Shipped as burner-only.
* **v1.9.0 R6 ("the deck offers bombs it doesn't have")** — understated. It was a
  free-ordnance bug in the launch path, not a display issue.
* **v1.9.0's own claim that the fixed screen was clean** — the harness found
  four more overlaps and click drifts after it (#75, #76, #78, #81).

## 3. Feedback on the prompt

**What worked:** "Improve the suggestions if potential, then follow them" is an
excellent instruction. It licensed measuring before building, which is where
most of this release's value came from.

**What to change:**

* **"Close all issues"** → say which kind: *bugs*, *player-facing*, or *launch
  blockers*. Otherwise the only way to comply literally is to delete honest docs.
* **"Test, validate, debug … everything entirely comprehensively"** → name the
  acceptance bar. For example: *"every harness check passes at desktop and
  phone; no page errors; production build loads under the Pages path"*. An
  unbounded bar is never met, so it is never clear when to stop.
* **"Ready to launch for pilot customers"** → say who they are (desktop or
  phone, sim fans or beginners). It changes which defects are blockers.
* **"Redeploy"** → say whether merging to `master` is authorised. It is the only
  way this repo deploys, and it is an outward-facing action.

**A prompt for the next round:**

> Share the live build with five people who have never played it. Collect their
> first-two-minute reactions verbatim through the in-game FEEDBACK link. Then:
> fix only what they hit, in order of how many hit it, with a regression test and
> a harness check for each. Do not add HUD elements. Report in under 150 lines.
