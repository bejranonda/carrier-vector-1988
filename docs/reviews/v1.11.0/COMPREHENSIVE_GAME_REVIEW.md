# Carrier Vector: 1988 — v1.11.0 Review

**Build:** `v1.11.0` · **Date:** 2026-09-24 · **Framework:** 12 dimensions
([`../REVIEW_TEMPLATE.md`](../REVIEW_TEMPLATE.md)) · **Evidence:**
[`PLAYTEST_EVIDENCE.md`](PLAYTEST_EVIDENCE.md)

---

## 0. Player Evidence

**Four sentences, one human, same as before — plus one new one mid-session.**
This release is driven by the same reviewer's desktop-mode complaints
("I just fly", "I should have menu to click", "many keyboard keys ... hard")
carried over from the request, and by an unprompted follow-up: *"let user have
fun to play too."* No new human has played the fixed build. §0 of
`PLAYTEST_EVIDENCE.md` maps each sentence to a measurement; none of the four
turned out to be a misunderstanding — the game really did leave a hands-off
pilot stalled for 90 seconds with no menu and no way to ask for help, and the
game's own instruction really did stall the jet at 85° of pitch. That is a
better hit rate for player evidence than most of this project's five-dimension
reviews managed with a dedicated playtest session.

## 0b. Rendered-Frame Evidence

`npm run playtest`: 33/33, up from 28/28 (5 new checks: the MENU button's
visibility, ESC opening the menu, the sim freezing while paused, the objective
panel's plain-language text, and RESUME closing it). Screenshots in
`playtest-output/`, notably `desktop-06-pilot-menu.png` (new).

---

## 1. Scores

| # | Dimension | v1.10.0 | v1.11.0 | Why it moved |
| :-: | :-- | :-: | :-: | :-- |
| 1 | First five minutes | 7.5 | **8.5** | A stalled pilot now has a menu, a plain-language "your job now" panel, and an autopilot offer; the game's own training-card instruction no longer stalls the jet |
| 2 | Screen legibility | 8.5 | 8.5 | Unchanged — the menu is a full-screen pause overlay, not a new permanent HUD region; FIRST_FLIGHT is still 3 optional regions, ARCADE still 8 |
| 3 | Control feel | 7.5 | **8.2** | `ASSIST`'s held climb no longer runs away to 85° and a near-stall; MANUAL is untouched |
| 4 | Micro-loop | 6.5 | 6.5 | Not this release's focus — see §3 |
| 5 | Mission & session structure | 7.5 | **8.2** | Every scripted phase now pays off with a banner and a tone instead of only a tactical-log line nobody mid-manoeuvre reads |
| 6 | Retention & meta | 8.0 | 8.0 | Unchanged |
| 7 | Deck loop | 4.5 | 4.5 | Unchanged — still an owner's design call (review R7) |
| 8 | Art, audio, atmosphere | 8.5 | 8.5 | Unchanged — the reward tone reuses an existing cue rather than adding one |
| 9 | Writing | 8.5 | 8.6 | The menu's plain-language instructions and item copy are new writing, held to the same voice |
| 10 | Engineering | 9.5 | **9.6** | 1,029 tests (was 989); a real regression test that reproduces the measured "take me home" failure and bounds it |
| 11 | Accessibility & reach | 8.5 | **8.8** | A clickable menu is a second path to every one of eight actions that previously required memorizing a key; keyboard, mouse and touch all reach it |
| 12 | Docs vs. code honesty | 8.5 | 8.6 | This suite discloses what was scoped out (below) rather than claiming the whole v1.10.0 roadmap shipped |

| | v1.9.0 | v1.10.0 | **v1.11.0** |
| :-- | :-: | :-: | :-: |
| Engineering & Craft | 8.17 | 8.83 | **9.00** |
| Player Experience | 6.67 | 7.44 | **7.72** |
| Composite (0.35 / 0.65) | 7.20 | 7.93 | **8.17** |

---

## 2. What is good now

* **A beginner who opens the pause menu gets told what to do, in plain words,
  and can have the autopilot do it.** "YOUR JOB NOW: CLIMB TO 2,500 FT — Hold W
  (or the up arrow) to raise the nose" is not a keycap and a jargon phrase; it
  is a sentence. `LET THE AUTOPILOT FLY` is one click away for a pilot who
  would rather watch.
* **The menu is genuinely clickable, not just "press ESC and hope"**: a
  corner `MENU (ESC)` button in flight and on the deck, a repointed touch
  control, and mouse hit-testing built from the exact rectangles the renderer
  draws (`PilotMenuView.pilotMenuLayout` — the same discipline `HudLayout` and
  `DeckLayout` already use, so a click can never land 10px from what the eye
  sees).
* **The game's own instruction no longer breaks the game.** Following Card 1
  ("hold W") used to take the nose to 85° in six seconds in the *default*
  flight mode. It cannot happen in `ASSIST` any more; a pilot who wants to loop
  is one key (`F` → MANUAL) away from the raw aeroplane.
* **"Take me home" takes you home**, even from the exact state a beginner
  playtest actually produced it in: close astern, pointed the wrong way. It was
  flying the jet further away for as long as anyone had watched it.
* **Every scripted step pays off** — a banner and a tone on completing the
  climb, arming the autopilot, splashing the drone — reusing text every
  scenario already had written and had never surfaced past a log panel nobody
  in the cockpit is reading.

## 3. What is still weak

* **Still nobody new has played it.** The single highest-value next step,
  named in the last two reviews, remains unbuilt: five people, the live URL,
  no instructions, verbatim quotes through the in-game feedback link.
* **The micro-loop (aim, lock, fire, hit) is untouched.** This release's fixes
  are about the first five minutes and the menu; the 0–5 second combat beat is
  exactly as good or as thin as it was in v1.10.0.
* **The briefing screen did not get the FIRST_FLIGHT treatment.** N1 from the
  v1.10.0 roadmap (hide the daily banner, trim the secondary row for a
  never-flown pilot) was not built this release — see §5 for why.
* **The training sortie's middle step still says `ENGAGE AUTOPILOT` rather
  than a plainer `TURN TOWARD THE DRONE`.** The pilot menu answers "what do I
  do" on demand now, which reduces the cost of this, but the objective strip
  itself is unchanged.
* **The deck loop is still shallow** (4.5), and SIM is still the neglected
  tempo (#82) — both exactly as noted in the last two reviews. Nothing this
  release touches either.

## 4. What I would cut next (standing rule #13)

1. **The `STICK: DIR/REAL` corner button**, now that pitch inversion is also
   reachable nowhere else new — it was already a minor, rarely-used toggle
   and the pilot menu's `CONTROLS` item covers it. (Not cut this release —
   flagged for the next one, since removing a working corner button without a
   replacement path needs its own check.)
2. **The keycap-heavy phrasing in three of the training cards' `keys` arrays**
   (`[['F', 'autopilot'], ['2', 'aim-9'], ['SPACE', 'fire']]`), now that the
   pilot menu can restate the same information in a sentence — worth
   revisiting once the training sortie itself is next reworked (see §5).

## 5. Limits of this review, and what was deliberately scoped out

Scored by the implementer, with no new human playtest, no audio review, and no
long-session data — the same limits as the last two releases. Additionally,
honestly, this release is **narrower than the roadmap it was building against**.
Three things sketched in planning were cut for time, not built and then
hidden:

* **A full "Ghost-Lead flies it" autopilot** that specifically targets each
  training step (climb to exactly 2,500 ft, auto-designate the drone) was
  simplified to a plain AUTO toggle. It is honest about what it does (the menu
  item's own copy says "Ghost-Lead holds her steady", not "flies the mission
  for you") and it reuses the same well-tested autopilot law every other AUTO
  interception already uses, rather than adding a new, untested one under
  time pressure.
* **A `FIRST_FLIGHT` briefing** (N1 from the v1.10.0 roadmap) was not built.
* **The `TURN_TO_DRONE` training-step rework** was not built; the training
  sortie's phase list is otherwise unchanged this release.

None of these were abandoned by finding they were unnecessary — they were cut
because the three defects the player actually reported (no menu, no help when
stuck, a jet that stalls itself and one that flies away when asked to come
home) were worth fixing correctly and testing thoroughly more than they were
worth fixing alongside three more speculative builds. See
`RECOMMENDATIONS_AND_ROADMAP.md` for where they stand now.
