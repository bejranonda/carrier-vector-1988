# v2.2.0 — Self-Critique

## 1. What the earlier releases got wrong, found only now

| What v2.0-v2.1 believed | What v2.2.0 found | Lesson |
| :-- | :-- | :-- |
| "Three-minute bot runs show the balance" | Dead air appears after three minutes: ~40% of an eight-minute EASY run waited on stragglers | Run long enough to be bored |
| "The 75 s wave timeout keeps a run from stalling" | It capped the stall at 75 s, and hid the cause - fighters hovering at 3 m/s | A safety net is not a fix; find what it is catching |
| "#100 and #101 are fixed" | #100's fix dropped the *newest* banner on short screens (#112); #101's floor still overflowed phones (#114) | A fix is only as good as the sizes it was tested at |
| "Text size works" | It did nothing on phones, and the zoom created 400-490 px layouts that broke the first screen (#113) | Test what the setting produces, not what the devices are |
| "EASY is for SCRAMBLE" | EASY on deck missions hid FIRE NOW under a training prompt for a whole sortie (#119) | An assist is a promise in every mode it can be switched on in |
| "The share card is the growth loop" | A phone could not send it (#115), and the link preview pitched the engine, not the game | Walk the loop end to end, on the device the audience uses |

## 2. What I got wrong this time, on the way

- **The first touch-kit tests passed with the chaff check still pointed at
  SCRAMBLE**: the harness failed 2 of 61 until the check was moved to a deck
  mission. The harness was right; the plan had not said where chaff still
  matters.
- **The phone text boost first made the coach line overlap the wave banner**
  (seen in a screenshot, not a test); and on phones the coach band had always
  sat over the middle of the screen, where the target is. Both are fixed - the
  second only because the boosted plate made an old problem obvious.
- **The first AI fix made a new stalemate.** Fighters that kept their speed
  and out-turned the jet sat on its tail at 150 m. Found by running the same
  stall diagnostic again on the fix - which is the point of re-measuring.
- **Two fixes for one stall, shipped together - nearly.** A per-wave log
  showed a MiG circling on the jet's tail *and* the coach hiding FIRE NOW;
  both got a fix in the same build, and the build measured better, so both
  looked right. Switched on and off one at a time, the tail break-off made
  every profile worse (the EASY hold-fire bot lost a sixth of its kills) and
  the coach fix did all the good. The rule came out. Measuring the pair
  would have shipped a regression with a good number on it.
- **One browser run nearly decided the strafing pass.** Eight minutes with
  passes came out at 19 kills against 36 without; many seeds said the
  opposite. The headless sim that settled it is now `npm run balance`.
- **`pkill -f "vite preview"` killed its own shell.** A tooling slip, not a
  game bug - noted because it cost a re-run.

## 3. Still weak

1. **No human has played any of it.** Six releases. For an audience defined
   as "older, not good at technique", a script cannot stand in.
2. **Bots are crude stand-ins.** The balance numbers are now 16-seed means,
   not single runs - but of four scripted players: one that holds FIRE, one
   that steers bang-bang, two that fire only when told. A person who steers
   a little, panics, or puts the phone down is none of them.
3. **Phone menus do not grow** (#103, partly): the briefing and the debrief on
   a phone stay at their normal size. The in-flight words were the priority.
4. **#104** - small labels are still below the 28 px guideline at EXTRA LARGE.
5. **The AI is still simple.** Fighters now keep their speed and make
   strafing passes, but they do not drag, bait, or work as a pair - and,
   turning a little better than the jet, one can still hold 0.5-1 km behind a
   STANDARD pilot who does not turn hard. Better than hovering; not yet a
   dogfight.
6. **Challenge links made before v2.2.0 open on different waves** - the bomber
   placement changed what a seed produces. The score to beat is still shown;
   the waves are not the challenger's.
