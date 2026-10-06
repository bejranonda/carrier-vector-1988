# v2.0.0 — Recommendations & Roadmap

Ranked by expected effect on "would a stranger play this twice", divided by
cost. ✅ shipped · 🔨 ready to build · 🤔 owner decision.

---

## Tier 0 — before anything else

### P1 🔨 Pilot-customer round (now four releases overdue)

Five people who have never seen the game, on the live build, first five minutes
recorded verbatim (screen + voice). Measure: seconds to first kill, whether
they press FLY AGAIN, how many runs before they stop, what they say on the
debrief. Every threshold in v2.0.0 (§Tier 3) is calibrated against a bot until
this happens. The briefing's `FEEDBACK` link is pre-filled and still unused.

---

## Tier 1 — shipped in v2.0.0 ✅

| Change | Lever | Where |
| :-- | :-- | :-- |
| SCRAMBLE as the first-flight mission | Time to fun: 4.2 s, one key | `Scramble.ts`, `Scenarios.ts` |
| Teaching waves, passive opening, accuracy ramp | Teach by escalation | `scrambleWave`, `fighterAccuracy` |
| Anti-stall (AEW picture, hunters, re-lock, bug-out) | A run never sits on one invisible bandit | `GameLoop.refreshDesignation`, `EnemyAI` |
| Kill chains ×2-×5 in every mission | Reward decisive play | `Combo.ts` |
| Ring + score pop, hit-stop, climbing chime, speed streaks | Juice | `KillFx.ts`, `SpeedStreaks.ts`, `SoundFX` |
| Medal stars, career XP, palette unlocks | Goals, persistence | `Medals.ts`, `Career.ts` |
| Debrief built around FLY AGAIN | Session chaining | `DebriefView.ts` |
| Daily = SCRAMBLE; a card for every run, with the URL | Acquisition | `DailySortie.ts`, `formatScrambleCard` |
| Procedural soundtrack + its own switch | Mood | `MusicPattern.ts`, `PilotMenu` |
| Challenge links: every card flies the sharer's waves | Acquisition | `Challenge.ts` |
| #88-#96 | Bugs the review found | see `KNOWN_ISSUES.md` |

---

## Tier 2 — next, in order

### N1 🔨 A sender name on challenges (~40 LOC)
Challenge links shipped (`?c=seed.score.waves`). A callsign picked once and
carried in the link ("MAVERICK held 7 waves for 12,400 — beat it") makes a dare
personal, which is most of its pull.

### N2 🔨 Contact visibility floor (~30 LOC)
Draw enemy meshes no smaller than ~14 px on screen, brightening slightly with
range, so a bandit at 3 km is something you see rather than something the lock
box tells you about.

### N3 🔨 First-run briefing (~60 LOC)
For a pilot with no records: the title, one line, one huge `ENTER - SCRAMBLE`.
Everything else appears after the first run. (Carried from v1.10.0 N1.)

### N4 ✅ A music toggle in the pilot menu
Shipped in v2.0.0's second pass.

## Tier 3 — calibrate, don't guess (needs P1)

### C1 🤔 SCRAMBLE difficulty curve (#97)
Per-wave fighter agility; escalation count; wave timeout. Tune from recordings.

### C2 🤔 Medal thresholds
"SCORE 8,000", "CLEAR WAVE 10", Carrier Defense "REACH WAVE 6". A star nobody
earns, or everybody earns on the first run, is wasted.

### C3 🤔 Positioning
v2.0.0 puts the arcade mode in front of the dual-loop sim. Owner to confirm
"arcade first, depth after" is how the game should present itself (README,
store page, social cards).

---

## What not to do next

- **Do not add more modes or more HUD** before P1. The game now has a front
  door; what it needs is evidence about what people do once through it.
- **Do not tune by bot.** The bot is a floor. It never touches the throttle.
- **Do not chase a 9/10 rubric score.** The rubric in this suite exists to point
  at the player; a number from the implementer is an upper bound, not a result.
