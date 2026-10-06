# v2.0.0 — Self-Critique: what is still weak, and what I got wrong

Written by the agent that built v2.0.0, after building it, against its own
work. The brief was "validate all at the end, criticise to improve more and
more"; this is that pass, kept separate from the review so it cannot be
softened by it.

---

## 1. Things I got wrong during the release (and how they were caught)

| Claim or change | What the measurement said | Outcome |
| :-- | :-- | :-- |
| "A new player's first kill takes well over two minutes" | A scripted pilot obeying the objective strip instantly scored it at **13.9 s** | Every doc corrected. The real problem was four instructions before the first reward, not the clock |
| "The AIM-9 misses because pure pursuit has no lead" | 80/80 hits for both laws across 40 geometries × 2 fighter behaviours | Guidance change **reverted**. The real causes were #90 (envelope 2× too long), #93 (launch at empty sky), #94 (ripple rounds flying blind) |
| A single mashing session as evidence of "fun" | It showed the opposite - every missile wasted before wave 1 | Became #93 |

Lesson, the same one this project keeps relearning: **estimate, then measure,
then write.** Two of my three confident early claims were wrong, and both would
have shipped as "facts" in the changelog without the instrument.

## 2. What is still weak in the build

### 2.1 Nobody has played it
Four releases in a row. Every number in this suite comes from scripts. The
scripted players are deliberately weak, which makes them useful as a floor and
useless as a ceiling. **The next release must not start before five strangers
have played the live build with their first five minutes recorded.**

### 2.2 Fighters are hard for weak pilots
The steering bot loses its jets mainly to waves 3-5. Hunters steer at
`ENGAGE_TURN_RATE` from the first armed wave; only their *accuracy* ramps
(`fighterAccuracy`). A per-wave **agility** ramp is the obvious next lever - but
the bot also never uses the throttle and banks no harder than ~50°, so it is
not yet evidence a human would struggle. Do not tune this before #2.1.

### 2.3 The briefing is still a dense first screen
Seven pills, three cards, a daily banner, eight secondary options. `START HERE`
and the big ENTER carry a new player through it, and ENTER is now the entire
onboarding - but a first-run briefing that is one title and one button would be
cleaner. This was the v1.10.0 roadmap's N1 and it is still unbuilt.

### 2.4 Spotting is carried by the HUD, not the world
Enemies are 20-metre wireframes at 2-3 km. On second look at the screenshots
the HUD already brackets every visible contact with a ring and a range label,
and SCRAMBLE's AEW picture makes every bandit visible to it - so this is a
polish item, not the defect the first draft of this critique called it. A
minimum on-screen mesh size would still make the *world* read better.

### 2.5 Medal thresholds and wave difficulty are guesses
"SCORE 8,000", "CLEAR WAVE 10", "REACH WAVE 6" come from the scoring tables,
not from play. Too easy and stars mean nothing; too hard and they are
wallpaper. Calibrate from recordings (#97).

### 2.6 Sharing is text, and there is no leaderboard
**Addressed in a second pass:** every SCRAMBLE card now ends in a challenge
link (`?c=seed.score.waves`) that flies the sharer's exact waves with their
score on the briefing and a verdict on the debrief. What remains: a text card
is still the weakest share format, a challenge has no sender name, and there is
no board - the no-backend policy rules out a server leaderboard.

### 2.7 The soundtrack has never been heard by a person
The pattern is unit-tested and the scheduler runs in Chromium without errors.
Whether it is pleasant, too loud, or annoying after five minutes is unknown. It
sits on its own bus at 0.16. **Second pass:** a `MUSIC: ON/OFF` switch in the
pause menu (remembered) turns it off without touching the effects.

### 2.8 Identity risk
The game's original pitch was a *dual-loop* sim: the deck and the sortie,
coupled. v2.0.0's front door bypasses the deck entirely. That is the right call
for a stranger's first five minutes, and the campaign is one key away, but it
is a positioning decision the owner should make consciously: "arcade first,
depth after" is now what the game says about itself.

### 2.9 Small things noticed and not fixed
- The designation label (`MIG-23 · 3.2KM · SIDEWINDER`) can overlap the
  altitude block (label declutter does not treat it as an instrument box).
- On a phone, SCRAMBLE opens with `ALPHA LIMIT` showing: the default AUTOPILOT
  climbs to its terrain-following height before the first wave arrives.
- `S` ("skip to airborne") on the briefing is redundant for SCRAMBLE.

## 3. If I had one more day

In order, with the reason:

1. **Pilot-customer round** (§2.1) - everything below is a guess until then.
2. **First-run briefing** (§2.3) - one title, one button, for a pilot with no
   records.
3. **A sender name on challenges** (§2.6) - a callsign the player picks once.
4. **Contact visibility floor** (§2.4) - polish, helps every mission.
5. **Fighter agility ramp** (§2.2) - only if the recordings agree with the bot.

(Challenge links, a music switch, and "no bonus for a bugged-out wave" were on
this list and were built in the second pass.)
