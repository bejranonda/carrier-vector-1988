# v1.11.0 — Recommendations & Roadmap

Ranked by player impact ÷ lines of code. ✅ shipped · 🔨 ready to build ·
🤔 owner decision.

---

## Tier 0 — Still before anything else: put it in front of people

### P1 🔨 Pilot-customer feedback round (carried over, unstarted for two releases)

Every menu screen has a `FEEDBACK` link pre-filled with the build, browser and
screen size. Nothing has used it yet. **Do not build anything below this line
before five new people have played the live build and their first two minutes
are recorded verbatim.** This is the third review in a row to say so.

---

## Tier 1 — Shipped in v1.11.0 ✅

| # | Fix | Why | Where |
| :-: | :-- | :-- | :-- |
| 1 | A real, clickable pause menu | "I should have menu to click and select what to do" | `PilotMenu.ts`, `PilotMenuView.ts` |
| 2 | The menu restates the objective in plain words | "I start and do not know what to do" | `PilotMenu.plainInstruction` |
| 3 | ASSIST caps a held climb at ~35° of pitch | The game's own instruction stalled the jet at 85° | `FlightAssist.climbLimited` |
| 4 | "Take me home" turns around instead of flying away | Measured flying the jet to 7.9 km and diverging | `ApproachGuidance`, `GameLoop.recoveryNav` |
| 5 | Every scripted phase pays off with a banner + tone | "let user have fun to play too" | `GameLoop.updateMission`, `Scenarios.shortCallout` |
| 6 | The training card's altitude line matches the altimeter's units | Beginner-visible mixed units, feet vs. metres | `Scenarios.ts` `FT()` |

All six have regression tests reproducing the measured failure, not just
asserting the new behaviour in isolation — see `PLAYTEST_EVIDENCE.md`.

---

## Tier 2 — Next, carried over from v1.10.0 and still true

### N1 🔨 A FIRST_FLIGHT briefing (~60 LOC)

Unchanged from the v1.10.0 roadmap: hide the daily banner and trim the
secondary row for a never-flown pilot. Lower priority than it was, now that
the pilot menu answers "what do I do" once the player is airborne — but the
briefing itself is still six missions, three cards and eight secondary
options on a screen a brand-new player sees first.

### N2 🔨 `TURN_TO_DRONE`: replace `ENGAGE AUTOPILOT` as the training sortie's middle step

The training sortie still asks a new pilot to verify a control law
(`ENGAGE AUTOPILOT`) as its second objective. A step that asks them to *turn
toward the drone* — completed by `contactOffNoseDeg <= 20`, no jargon — is
closer to what the fun actually is (the next step is shooting it) and needs
one new field on `MissionSnapshot`.

### N3 🤔 A SIM airframe pass (#82)

Unchanged. SIM's on-speed approach speed is still clamped below what its own
handling asks for.

---

## Tier 3 — New this release

### R1 🔨 A genuine "Ghost-Lead flies the climb" autopilot (~80 LOC)

`LET THE AUTOPILOT FLY` in the pilot menu is honestly labelled — it switches
to AUTO, which holds wings level and the present heading — but a pilot stuck
on `CLIMB TO 2,500 FT` would be better served by an autopilot that actually
climbs to 2,500 ft and, once there, designates the drone. This was scoped out
of v1.11.0 for time (see the review's §5); the well-tested `navTarget()` /
`autopilotDemand()` machinery this would extend already exists.

### R2 🤔 Should the reward banner distinguish training from combat?

`shortCallout` now banners every scripted phase's own callout line, including
combat scenarios' (`CANYON_STRIKE`, `IRON_HAND`, `LAST_STAND`,
`CARRIER_QUALS`). That is probably fine — those callouts were already written
as short, satisfying lines — but nobody has watched a five-wave `CARRIER
QUALS` run with a banner on every phase transition to confirm it does not
become noise on a longer mission. Watch it in the feedback round (P1).

---

## Deletions (standing rule #13)

* Nothing removed this release. See the review's §4 for two candidates
  flagged, not yet cut, for the next one.

## What not to do next

* **Do not build N1, N2, R1 before the feedback round (P1).** All three are
  reasonable, all three are guesses about what a beginner needs next, and the
  actual beginner evidence this release ran on was four sentences from one
  person plus this project's own measurement. That is enough to fix what was
  reported; it is not enough to keep guessing past it.
* **Do not add another HUD element or corner button.** `HudDensity.test.ts`
  still holds FIRST_FLIGHT to three optional regions and ARCADE to eight; the
  pilot menu is a full-screen pause, not a permanent addition to either count.
