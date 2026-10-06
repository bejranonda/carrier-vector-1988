# v2.1.0 — "Every Pilot": a review for players who are not gamers

The brief, verbatim: *"Think about player are not professional gamer, and can
be olders who are not good at technique."* Then: *"Research, try, test and
validate in multi perspectives to make it hit."*

Reviewer: the agent that then built v2.1.0. **No human playtest** — §0.

---

## 0. Evidence and its limits

Scripted players in headless Chromium (four profiles, §3), the checked-in
browser harness (61 checks), 1,134 unit/integration tests, rendered
screenshots of every screen at three text sizes and five devices, and the
published guidance in §5. Scripts can prove a wall exists and that it moved;
they cannot say whether a 70-year-old enjoys the result. That needs people.

---

## 1. Frank verdict on v2.0.0, for this player

v2.0.0 fixed the *order* of the game for a stranger: airborne on ENTER, a
kill in ~4 s. For a player who is not quick with their hands, three things
were still in the way:

| # | Barrier | How it showed | Severity |
| :-: | :-- | :-- | :-: |
| 1 | **Steering.** Every kill after the first needed the player to turn toward a target with one key while watching for "in range" | Relaxed bot: first kill 5 s, then minutes on `LOCKED - TURN TOWARD THE BANDIT` | Critical |
| 2 | **Text size.** Almost every label 9-12 px; no way to enlarge | Font tally across five screens | High |
| 3 | **Jargon.** "Bandit", "splash", "check six", "escort", "AIM-9" in the instructions | Coach and wave-brief strings | Medium |
| 4 | **Pace and punishment.** Full-speed waves, 1.6 s banners, three jets | Bot reading speed vs banner life | Medium |
| 5 | **Gamer idioms.** Highlight-then-confirm; hold-to-autofire not offered | Found while building the fix (#98) | Medium |

None of this is unusual for a flight game. It is unusual for a game that
wants to be a hit, because the audience it leaves out is large: AARP counts
~45% of Americans over 50 as monthly players, averaging 12 hours a month (§5).

---

## 2. What v2.1.0 does about each

| Barrier | Change | Principle |
| :-- | :-- | :-- |
| Steering | **EASY flying:** the autopilot flies every intercept; the lock is always on; a 90° missile cone | Remove the skill, keep the decision (when to fire) |
| Firing | **Smart trigger** on SPACE / click / FIRE: missile when it will land, cannon when close, "NOT YET" otherwise; **hold to keep firing** | One button; mouse-only play |
| Text | **Text size** NORMAL / LARGE / EXTRA LARGE as a UI zoom, on `T` from the first screen | Resizable text, scaled with its layout |
| Jargon | Plain-language orders; flavour kept in celebrations | Say what to do, in words a non-player knows |
| Pace | 80% world speed, 1.7× message hold, half shake | Time to read and react |
| Punishment | Half damage, five jets, missiles refill, gentler fighters | An "ultra-low" difficulty that still progresses |
| Discovery | **Asked once** on the first FLY: two big cards, EASY recommended; switches in the menu and on the briefing; offered again, once, after two lost jets in STANDARD | The setting is offered, never hidden |

Nothing is faked: EASY is control laws and tuning over the same simulation,
like every assist before it. STANDARD is unchanged, and a returning pilot is
never asked.

---

## 3. Validation from eight perspectives

| # | Perspective | How it was tested | Result |
| :-: | :-- | :-- | :-- |
| 1 | **Relaxed / older player on EASY** | Bot: 1.5 s reactions, never steers, SPACE when told — 3 min | **11 kills, 5 waves (★), 0 jets lost** (STANDARD: 6 kills, 4 waves) |
| 2 | **The same player, using EASY's advice** (hold fire) | Bot holds SPACE — 3 min | **12 kills, on wave 6, 0 jets lost** |
| 3 | **Mouse-only, EXTRA LARGE text** | Harness session: T twice, click FLY, click EASY, hold the button | 3 kills in **19.7 s**; never told to steer; FLY AGAIN by click |
| 4 | **Brand-new STANDARD player** | Harness | Asked once; first kill < 10 s; held bank still turns; deck path intact |
| 5 | **Returning veteran** | Smoke + harness | Never asked; keeps STANDARD; no beginner checklist |
| 6 | **Phone / tablet** | Harness (2 handsets) + chooser script (tablet at 150%) | Question tappable; EASY on; FIRE is the smart trigger; banners stay on screen |
| 7 | **Reduced motion / colour-blind** | `reducedMotion: 'reduce'` context; palette tests | Shake 0; colour-blind palette never locked, all palettes ≥ 4.5:1 |
| 8 | **Performance** | Busy late wave: 7 contacts, streaks, bloom | p50 16.7 ms, p95 16.8 ms |

The first EASY build **failed** perspective 1 (5 kills vs STANDARD's 6). Its
diagnostics showed a fighter sitting at 100-140° off the nose for most of a
wave — outside the standard missile cone — while the autopilot turned circles.
Widening EASY's cone to the wing line, and making the coach say FIRE NOW
exactly when the trigger would fire, is what turned it into a win.

---

## 4. Scoring (implementer, provisional)

The v2.0.0 "hit" rubric, re-read for a non-gamer:

| Dimension | v2.0.0 (non-gamer) | v2.1.0 (non-gamer) | Why |
| :-- | :-: | :-: | :-- |
| Hook | 7 | **8** | Asked one plain question, then a kill in seconds |
| Core loop | 3 | **7** | No steering wall; hold-to-fire progresses waves |
| Juice | 8 | 8 | Unchanged |
| Goals | 6 | **7** | First star now reachable for this player (measured) |
| Persistence | 7 | 7 | Unchanged |
| Again | 9 | 9 | Unchanged |
| Shareability | 8 | 8 | Unchanged |
| Clarity | 4 | **7** | Plain words, big text, "NOT YET" with a reason |
| **Mean** | **6.5** | **7.6** | |

---

## 5. Research

- **Audience.** ~45% of Americans 50+ (52.4 million) play monthly, ~12 h a
  month, and 84% of them play on smartphones; puzzle/card/word games lead —
  [AARP via GameDev Reports](https://gamedevreports.substack.com/p/aarp-45-of-50-aged-in-the-us-are), [AARP, 50-plus gamers](https://www.aarp.org/personal-technology/50-plus-gamers/), [AARP, accessibility preferences of older gamers](https://www.aarp.org/pri/topics/technology/internet-media-devices/gamer-accessibility-preferences-older-adults/), [Axios, over-50 gamers feel overlooked](https://axios.com/2023/04/20/over-50-gamers-study-aarp).
- **Guidelines.** Text should be resizable, with a minimum of 28 px at 1080p;
  four or more difficulty levels or individually adjustable assists (e.g.
  auto-aim); an ultra-low difficulty mode that still lets players progress —
  [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines), [XAG 101 text display](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md).
  The community checklist ranks adjustable difficulty and simple controls as
  *basic* and one-handed play as *intermediate* —
  [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/?p=3285), [Games for Change, designing for disabled gamers](https://gamesforchange.org/studentchallenge/wp-content/uploads/2022/01/Tips_Resources_for-Considering-the-Needs-of-Disabled-Gamers-in-Design.pdf).
- **Design for older adults.** Adjust speed and difficulty in stages; offer
  practice, timing hints after repeated failure, and speed settings —
  [Game Design Guide for Adults 50+](https://wikidocs.net/155866).

### Against those benchmarks

| Guideline | v2.1.0 |
| :-- | :-- |
| Resizable text | ✅ three sizes, whole-UI zoom (not on phones — #103) |
| 28 px minimum at 1080p | ❌ small labels reach 15 px at EXTRA LARGE (#104) |
| Assists / auto-aim | ✅ EASY: autopilot intercept, lock, smart trigger, wide cone |
| Ultra-low difficulty that still progresses | ✅ EASY earns the first star for a non-steering bot |
| One-handed / simplified input | ✅ one key, or a mouse alone |
| Speed setting | ✅ EASY at 80% (not separately adjustable) |
| Hints after failure | ✅ NOT YET with a reason; "HAVING A HARD TIME?" offers EASY after two lost jets |
| Phone first (84% of 50+) | ⚠ EASY works on phones; text size does not (#103) |
