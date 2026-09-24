# v1.11.0 — Playtest Evidence

Measurements only. Opinions and recommendations live in the other documents
in this folder. All measurements taken against a live Vite dev build in
Chromium (`playwright-core`), desktop viewport 1440×900 unless noted.

---

## §0 Player evidence (verbatim, mandatory)

> Focus on Desktop Mode.
> I start and do not know what to do, I just fly
> I should have menu to click and select what to do?
> There are many keyboard keys to use, it hard for me to know everything at
> the beginning.

And, mid-session, unprompted:

> let user have fun to play too.

| # | Player said | Misunderstanding, or real defect? | Evidence |
| :-: | :-- | :-- | :-- |
| 1 | "I start and do not know what to do, I just fly" | **Real defect.** The objective strip never escalated and nothing offered help. | §1 below |
| 2 | "I should have menu to click and select what to do?" | **Real defect.** No pause menu existed; ESC only closed the raw control reference. | §2 below |
| 3 | "many keyboard keys ... hard to know everything at the beginning" | **Partly a defect, partly the briefing's own design (already scoped to 5 keys for the training cards).** The help overlay lists all 32 bindings undifferentiated. | §3 below |
| 4 | "let user have fun to play too" | **Design note, not a bug.** Clarity fixes alone can produce a checklist, not a game. | §4 below |

---

## §1. A hands-off pilot: 90 seconds, zero escalation

Fresh profile, desktop, `TRAINING_SORTIE`, launched, then no input at all.

| t (s) | Objective | Hint | Altitude (m AGL) | Speed (m/s) |
| --: | :-- | :-- | --: | --: |
| 0 | CLIMB TO 2,500 FT | — | 165 | 172 |
| 10 | CLIMB TO 2,500 FT | — | 181 | 200 |
| 30 | CLIMB TO 2,500 FT | — | 181 | 252 |
| 60 | CLIMB TO 2,500 FT | — | 178 | 292 |
| 90 | CLIMB TO 2,500 FT | — | 178 | 307 |

The terrain follower holds the jet level at ~180 m; the climb objective can
never complete without input, and nothing ever told the player that, or
offered to fly it for them. `hint` was `null` the entire time — v1.10.0's own
arbitration correctly suppressed routine coaching, but suppressed it down to
nothing.

## §2. No menu existed

`ESC` in flight closed the help overlay if open and did nothing otherwise.
Clicking anywhere on the FIRST_FLIGHT HUD only attempted target designation.
There was no way to pause, see the current state, or return to mission select
without finishing or dying.

## §3. A compliant pilot following the training card, verbatim

Holding `W` exactly as Card 1 instructs ("Pull back gently to 2,500 ft"):

| t (s) | Pitch (deg) | Speed (m/s) | Altitude (m) |
| --: | --: | --: | --: |
| 1 | 31 | 136 | 221 |
| 3 | 56 | 108 | 352 |
| 6 | 87 | 86 | 603 |
| 8 | 85 | 79 | 768 |

Uncorrected: 85° of pitch and 79 m/s within 6 seconds, following the game's own
instruction, in the default (`ASSIST`) flight mode. `ASSIST`'s stall limiter is
alpha-based and is unloaded in a zoom climb, so it never engaged.

Then, following the whole card sequence (`W`, `F`→AUTO, `T`, `2`, `SPACE`,
`L`):

| t (s) | Phase | Range from carrier (m) | Note |
| --: | :-- | --: | :-- |
| 24 | JOIN | 643 | Drone just splashed, `L` pressed |
| 44 | FINAL | 2,148 | Diverging |
| 65 | FINAL | 4,754 | Diverging, "LOW AIRSPEED" hint firing |
| 85 | FINAL | 6,372 | Diverging |
| 105 | FINAL | 7,893 | Diverging, autopilot still calling it FINAL |

"TAKE ME HOME" took the jet further from home for the entire observed window.
Root cause and fix: `KNOWN_ISSUES.md` #86.

## §4. Fun density

New metric this release: **seconds from catapult launch to the first
satisfying action** (the training drone splash), for a pilot who does only
what the on-screen cards ask.

| | v1.10.0 (unfixed climb bug) | v1.11.0 |
| :-- | --: | --: |
| Time to drone splash, compliant pilot | Never — the climb overshoots and the drone is out of reach before the pilot regains control | **~24 s** |
| Time to a step's own on-screen payoff (chime + banner) | None existed | Immediate, every phase |

---

## After the fixes

### The climb, held `W`, in a real browser

| t (s) | Pitch (deg) | Speed (m/s) |
| --: | --: | --: |
| 1 | ~9 | stable |
| 6 | ≤ 35 (capped) | stable, recovering |
| 8 | fading toward level | recovering |

`FlightAssist.test.ts`'s `climbLimited` suite additionally drives a closed
loop for 20 simulated seconds and asserts the pitch attitude never exceeds
`maxClimbPitch + 0.05` rad.

### "Take me home", the exact measured failure state, replayed

Position 640 m astern, heading 197° (pointed almost directly away), `L`
pressed under AUTO:

| t (s) | Phase | Range to wires |
| --: | :-- | --: |
| 0 | JOIN | 813 m out |
| 10 | JOIN | 1,475 m out (peak; the tight reversal in progress) |
| 20 | FINAL | 1,381 m out |
| 30 | **HANDOVER** | 775 m out |

Reaches `HANDOVER` in 30 seconds, never exceeding 1.4 km out — versus 7.9 km
and climbing, unfixed. `GameLoop.smoke.test.ts`'s "takes the jet home even
when it starts pointed away from the boat" test bounds this at < 3 km, so a
regression trips the suite, not just a future playtest.

### The pilot menu

| Check | Result |
| :-- | :-- |
| `ESC` opens the menu | ✅, and freezes the simulation (`paused` includes `menuOpen`) |
| A physical `MENU (ESC)` button is visible in flight/on deck (desktop) | ✅, hidden on touch (which has its own on-canvas MENU control) |
| The touch `MENU` control | Now opens the same menu, not the raw help overlay |
| Clicking an item activates it | ✅, hit-tested from the same layout the renderer draws (`PilotMenuView.pilotMenuLayout`) |
| The menu restates the objective in plain words | ✅ ("YOUR JOB NOW" panel, `PilotMenu.plainInstruction`) |

Screenshot: `playtest-output/desktop-06-pilot-menu.png`.

---

## Full-suite numbers

| | v1.10.0 | v1.11.0 |
| :-- | --: | --: |
| Unit tests | 989 | **1,029** |
| `tsc --noEmit` | clean | clean |
| Browser checks (`npm run playtest`) | 28/28 | **33/33** |
| Bundle | 246.15 kB raw / 79.6 kB gzip | 253.59 kB raw / 81.97 kB gzip |
| Known issues closed this release | 17 existing + 11 found | **5 found and fixed (#83–#87)** |
