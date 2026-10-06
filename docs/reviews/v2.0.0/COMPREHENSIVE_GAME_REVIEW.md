# v2.0.0 — Frank Review: "Would a stranger play this twice?"

Reviewer: the agent that then implemented v2.0.0. **No new human playtest** —
read §0 before trusting any number below.

---

## 0. What this review is, and is not

Eleven releases of this project produced eleven review suites, a 12-dimension
rubric, and a composite score that climbed from 5.76 to 8.17. None of those
suites asked the question the owner actually asked this time: *what would make
this a hit?* A score of 8.17 / 10 on a rubric that grades HUD collisions and
recovery-assist accuracy says nothing about whether anyone outside the project
would play the game for five minutes, come back tomorrow, or send it to a
friend. So this review grades a different thing, with a different rubric, and
says so.

It is grounded in three kinds of evidence, in descending order of weight:

1. **The live build, driven in Chromium** — the existing harness plus two new
   scripted players (a "button-masher" and a steering bot), with screenshots
   at every interesting moment. See [PLAYTEST_EVIDENCE.md](PLAYTEST_EVIDENCE.md).
2. **The source**, read for causes once the browser showed a symptom.
3. **Published practice** on what makes short-session games retain players
   (sources in §5). Treated as prior, not proof.

It is **not** human playtest evidence. The project has now gone four releases
saying "five strangers before anything else" and not doing it. That remains the
single most important thing missing, and §4 of the roadmap says so again.

---

## 1. Frank verdict on v1.11.0

**As a piece of engineering it is unusually good.** Zero runtime dependencies,
a hand-written 6-DOF model, a projection derived from the same basis vectors as
the flight model, 1,029 tests, a browser harness, honest known-issues. Nothing
in this review is about code quality.

**As a game a stranger finds on the web, it was not going to be a hit, and the
reason was not any single bug.** It was the order of experiences:

| What a new player met, in order | Time | What it felt like |
| :-- | :-: | :-- |
| CRT warm-up | 2.6 s | Atmospheric, fine |
| Briefing: six missions, three cards, a daily banner, eight secondary options | — | A menu before a game |
| Deck screen: orders, turnaround bar, payload, threat rose, log | — | A spreadsheet before a game |
| Catapult stroke | ~3 s | Great, actually |
| "CLIMB TO 2,500 FT" | ~9 s | Holding W |
| "ENGAGE AUTOPILOT" | — | Verifying a control law |
| Lock the drone, fire | ~1 s | The first fun |
| Fly home, trap aboard | — | The hardest skill in the game, as the tutorial's final exam |

Measured with a scripted pilot that obeys the objective strip the instant it
changes, the first kill came **13.9 s** after ENTER — after four distinct,
correct actions read off the screen, and before any human reading time on the
briefing cards and the deck panels. (This review's first draft *estimated*
"over two minutes" from the shape of the flow; the measurement corrected it,
and the correction is kept here on purpose.) Every reference
point for "a hit" in this space — browser arcade games, Ace Combat's arcade
mode, the run-based games that dominate session counts — puts the player in the
action inside seconds and teaches by escalating the action, not by lecturing
before it (§5).

**And after a run there was nothing to come back for** except a bigger number.
No goal with a name, no progress that survived a bad run, no unlock, no "again"
button — the debrief's only way out was "back to mission select". The daily
sortie existed and was a genuinely good idea, but it was the *endless deck
mode*, the slowest thing in the game to get into.

### What the browser found that eleven reviews had not

| # | Finding | Severity |
| :-: | :-- | :-: |
| 88 | The six-step beginner checkout ("hold W") was pinned over **every** Carrier Defense run, veterans included, and its coach line replaced combat hints a minute into the fight | High |
| 90 | The HUD and coach called "IN RANGE — FIRE" at **8 km**; the missile reaches ~3.8 km | High |
| 89 | "ON APPROACH — LINE UP WITH THE DECK" on every catapult climb-out | Medium |
| 93 | Mashing SPACE before contacts existed fired every missile into empty sky | Medium |
| 94 | Ripple-fired missiles flew on blind after their target died — "misses" 3-7 m from the wreck | Medium |
| 92 | Four kills = four banners stacked over the bottom of the screen | Low |
| 91 | The deck title was drawn under the v1.11.0 `MENU (ESC)` button | Low |

#91 is in the v1.11.0 harness's own screenshot. The harness took the picture;
nobody looked at it. Standing rule worth adding: **a harness screenshot that
nobody opens is not a check.**

---

## 2. The "hit" rubric

Eight dimensions, each asking what a player feels, scored 0-10. v1.11.0 is
scored as found; v2.0.0 by its implementer, so treat that column as an upper
bound until people play it.

| Dimension | What it asks | v1.11.0 | v2.0.0 | Why |
| :-- | :-- | :-: | :-: | :-- |
| **Hook** | Is the first 60 seconds fun? | 4 | **8** | First kill 4.2 s and one key after ENTER (measured); was 13.9 s and four instructions for a perfect bot |
| **Core loop** | Is the 30-second loop satisfying on repeat? | 5 | **7** | Waves with a clear end, rearm, escalate. Dogfights against hunters are still hard for weak players (#97) |
| **Juice** | Does a kill *feel* like a kill? | 5 | **8** | Chain banner, ring + points at the wreck, hit-stop, climbing chime, speed streaks, a soundtrack |
| **Goals** | Is there a named next thing to want? | 3 | **8** | Three named stars per mission, "NEXT ★ ..." on the selector, unlock teaser on the debrief |
| **Persistence** | Does a bad run still bank progress? | 2 | **7** | Career XP every run, levels, unlocks priced in stars |
| **Again** | Is "one more" one key away? | 3 | **9** | ENTER on the debrief = same mission, straight back in |
| **Shareability** | Does a run leave something to send? | 5 | **8** | Every SCRAMBLE card is a challenge link that flies the sharer's exact waves; the daily is a SCRAMBLE. Still text-only, still no leaderboard |
| **Clarity** | Does a stranger know what to do, without reading? | 5 | **7** | The wave banner says it ("ONE BOMBER DEAD AHEAD - SPACE TO FIRE"). The briefing is still dense |
| **Mean** | | **4.0** | **7.8** | |

A 4.0 is not an insult to a project with this much craft in it. It is the
honest gap between "a beautifully engineered flight sim" and "a game people
pass around", and it is the gap v2.0.0 was built to close.

---

## 3. What v2.0.0 changed, and why each piece

The principle: **keep the sim, change the order.** Nothing deep was removed —
the deck, the canyon strike, the trap, the SAM belt are all one key away. What
changed is what a stranger meets first and what every run pays out.

| Change | The hit lever it pulls | Evidence it worked |
| :-- | :-- | :-- |
| SCRAMBLE as the first-flight mission | Time to fun | First kill 4.2 s (harness asserts < 10 s) |
| Waves that each teach one idea | Teach by escalation | Wave 1-2 passive; wave banners carry the instruction |
| Kill chains, ×2-×5 | Mastery reward, "aggressive play pays" | Unit + smoke tests; one banner, not four |
| Shockwave ring, score pop, hit-stop, streaks | Juice where the eye already is | Screenshots in the evidence file |
| Medal stars, career XP, palette unlocks | Goals and persistence | Smoke test: a run pays a star and XP |
| Debrief rebuilt around FLY AGAIN | Session chaining | Harness: ENTER on debrief = airborne again |
| Daily = SCRAMBLE; every card a challenge link | Acquisition through sharing | Card/link tests; harness opens a link and flies its seed |
| Soundtrack that layers with the fight | Arcade mood | Pattern tests; no audible human check (§4 of the critique) |
| Anti-stall: AEW picture, hunters, re-lock, bug-out | A run can never sit on one invisible bandit | Bot runs before/after; smoke test |

---

## 4. What is still weak (short version — the long one is the critique)

1. **No human has played it.** Fourth release running.
2. **Dogfighting hunters is hard for a weak pilot.** The bot loses its jets to
   waves 3-5 fighters. Accuracy ramps; agility does not yet.
3. **The briefing is still a dense first screen** — seven pills, three cards, a
   daily banner, eight options. `START HERE` and the big ENTER carry it, but a
   true first-run briefing would be one button.
4. **Visual identity is strong but sparse** — enemies are small wireframes at
   2-3 km. Streaks help speed; nothing yet helps *spotting*.
5. **Sharing is text.** Challenge links make a card a direct dare, but there
   is no image card and no leaderboard (no backend, by policy).

---

## 5. Research notes

- Day-1 retention is "the clearest early signal of whether your onboarding and
  first session land"; ~40% D1 is the benchmark hyper-casual teams iterate or
  kill against, and drop-off during onboarding "may imply that the game is
  hard, boring, or too complex" — [Supersonic, *6 ways to boost D1-D7*](https://supersonic.com/learn/blog/6-ways-to-boost-your-games-retention-from-d1-d7/), [Riseup Labs, *game retention metrics*](https://riseuplabs.com/game-retention-metrics/).
- Arcade/hyper-casual titles win on short loops and high session counts, not
  session length — [GameRefinery, *hyper-casual stats*](https://www.gamerefinery.com/hyper-casual-gaming-the-latest-stats-and-trends-you-need-to-know/), [Melior Games, *mechanics that drive retention*](https://meliorgames.com/game-development/game-mechanics-that-drive-player-retention/).
- Arcade flight games are carried by "fast-paced distorted physics" and lots of
  missiles, medals for replay, and the urge to "run it back immediately" after
  a score you suspect you could beat — [Ace Combat 2 (Wikipedia)](https://en.wikipedia.org/wiki/Ace_Combat_2), [Ace Combat Arcade Mode wiki](https://acecombat.wiki.gg/wiki/Arcade_Mode), [Trusted Reviews, *Ace Combat 7*](https://trustedreviews.com/reviews/ace-combat-7-skies-unknown).
- Hit-stop of 50-100 ms "makes it feel like it connected with real force";
  shake should stay small; juice is "seasoning, not the meal" — [Wayline, *Game Feel & Juice*](https://www.wayline.io/learn/game-feel/1), [Easton Dev, *where game feel comes from*](https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/).

These shaped the priorities: time-to-fun first, then the "again" button, then
named goals, then juice — in that order, because juice on a game nobody reaches
the fun of is wasted.
