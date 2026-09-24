# v1.10.0 — Recommendations & Roadmap

> **Status: partially carried forward into v1.11.0 — read
> [`../v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md`](../v1.11.0/RECOMMENDATIONS_AND_ROADMAP.md)
> first.** N1 (a FIRST_FLIGHT briefing) and N3 (a SIM airframe pass) are still
> open. N2 (the browser harness in CI) is unaddressed. P1 (a pilot-customer
> feedback round) is unaddressed for a third release running.

Ranked by player impact ÷ lines of code. ✅ shipped · 🔨 ready to build ·
🤔 owner decision. What happened to the v1.9.0 list is in
[`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md).

---

## Tier 0 — Before anything else: put it in front of people

### P1 🔨 Pilot-customer feedback round

Every menu screen now has a `FEEDBACK` link that opens a GitHub issue pre-filled
with the build, browser and screen size, and a crash produces the same with the
error attached. Use them: five new players, no instructions, the live URL.

**Record verbatim** what they say in the first two minutes (template §0). That is
the only evidence that can confirm or refute this release's scores. Do not build
Tier 1 until it is in.

---

## Tier 1 — Next, if the feedback does not change the order

### N1 🔨 A FIRST_FLIGHT briefing (~60 LOC)

The cockpit and deck got the small-screen treatment; the briefing did not. For a
pilot who has never flown: hide the daily banner, show only the START HERE
mission's cards, and cut the secondary row to `H all controls`. Everything else
returns after the first completion, exactly like the HUD.

### N2 🔨 Put the browser harness in CI, non-blocking (~30 lines of YAML)

A separate workflow, not part of the deploy gate, that runs `npm run playtest`
and uploads `playtest-output/` as an artifact. First make the turn-rate check
simulation-timed rather than wall-clock timed so a slow runner cannot flake it.

### N3 🤔 A SIM airframe pass (#82)

SIM keeps the original wing, which cannot make a level hard turn and whose
on-speed approach speed (~100 m/s) is above what the wires take. Either give SIM
its own honest airframe, or retire SIM's claim to be "the original numbers".

---

## Tier 2 — Design work (owner decisions)

* 🤔 **R7, the deck loop** — deepen (fuel vs. ordnance with felt consequences) or
  shrink to a single "launch" screen for everyone. Now that the magazine really
  constrains the loadout, *deepen* has something to build on.
* 🤔 **#53, a branching map** — new content, with scenario re-balancing.
* 🤔 **Key remapping UI (#41, P2)** — layout independence shipped; a remap
  screen is only worth it if feedback asks for it.

---

## Deletions (standing rule #13)

* The daily-sortie banner for never-flown pilots (N1).
* Four of eight briefing secondary options on FIRST_FLIGHT (N1).

## What not to do next

* **Do not add HUD elements.** `HudDensity.test.ts` holds FIRST_FLIGHT to three
  optional regions and ARCADE to eight. Raising either is a decision to make on
  purpose, in review.
* **Do not commission another review before the feedback round.** The v1.9.0 and
  v1.10.0 measurements say what the code does; only players can say whether it
  works.
