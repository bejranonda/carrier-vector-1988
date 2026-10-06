# v2.1.0 — Playtest Evidence

Headless Chromium (Playwright), dev build, `window.__game` / `window.__ui`
dev handles. **No humans.**

## 1. The relaxed player

A scripted profile meant to stand in for a player who is not quick with their
hands: reacts every **1.5 s**, **never steers**, presses SPACE only when the
coach or the objective says FIRE / SPACE. 180 s of SCRAMBLE per run.

### Baseline (v2.0.0)

| Time | Waves cleared | Kills | Coach line most of the time |
| :-: | :-: | :-: | :-- |
| 32 s | 1 | 2 | `LOCKED - TURN TOWARD THE BANDIT UNTIL IT IS IN RANGE` |
| 93 s | 2 | 3 | same |
| 180 s | 3 | 4 | same |

First kill at 5.1 s — then the steering wall.

### First EASY build — did not help

| Profile | Kills | Waves | Jets lost |
| :-- | :-: | :-: | :-: |
| STANDARD | 6 | 4 | 0 |
| EASY (presses when told) | 5 | 4 | 0 |
| EASY (holds fire) | 8 | 4 | 0 |

Diagnostics on the hold run: for most of wave 4 the locked fighter sat at
aspect −0.51 to −0.73 (100-140° off the nose) at 0.6-4.5 km. The standard
missile cone (cos ≥ 0.64) never offered it; the autopilot turned circles at
~110 m/s. The coach also went quiet, because "fire now" depended on the
standard envelope.

### Final EASY build — 90° cone, truthful FIRE NOW

| Profile | Kills | Waves cleared | Jets lost | Hull | Score |
| :-- | :-: | :-: | :-: | :-: | :-: |
| STANDARD (presses when told) | 6 | 4 | 0 | 100% | 3,429 |
| **EASY (presses when told)** | **11** | **5 (★)** | 0 | 100% | 6,306 |
| **EASY (holds fire)** | **12** | **5, on wave 6** | 0 | 100% | 6,438 |

EASY does this with the world running at 80% speed — about 2.4 minutes of
game time in the 3 minutes of real time.

### Found by the bot along the way

- **#98** The fly-style question: pressing `1` only highlighted EASY; the bot
  waited three minutes on it. Keycaps now act at once.

## 2. The older-player browser session (harness)

1440 × 900, mouse only after two presses of `T`:

| Step | Check | Measured |
| :-- | :-- | :-- |
| `T`, `T` on the briefing | EXTRA LARGE, zoom 1.5 | ✅ |
| Click FLY | the fly-style question opens | ✅ |
| Click the EASY card | airborne on EASY | ✅ |
| Hold the mouse button | 3 planes shot down | **19.7 s** |
| Every coach line seen | none asks to steer | 0 found |
| ESC | menu has EASY FLYING, TEXT SIZE | ✅ |
| Click FLY AGAIN | airborne again | ✅ |

## 3. Harness — 61/61

New since v2.0.0's 48: the fly-style question on every new-pilot path
(desktop, training, challenge, two phones — each phone taps the EASY card and
asserts EASY is on), and the seven older-player checks above.

## 4. Screens

Every screen rendered at NORMAL / LARGE / EXTRA LARGE on desktop (1440 × 900),
laptop (1280 × 720), phone (844 × 390) and tablet (1180 × 820):

- **Font multiplier (first attempt):** at 150%, card bodies, menu rows, the
  debrief stat grid and callout plates overlapped — fixed line heights.
  Abandoned for a UI zoom.
- **UI zoom:** clean at 125% and 150% on desktop and laptop. On the phone a
  1.08 zoom crowded the cockpit, so the zoom floor was raised to 720 × 400 —
  phones are not zoomed (#103).
- **Chooser:** copy truncated on desktop and the RECOMMENDED tag overlapped
  text on the phone in the first build; both fixed (wider cards, a "tight"
  layout, the tag drawn only where it fits).
- **EASY flight:** `ALPHA LIMIT` showed on screen (autopilot jargon) — hidden
  in EASY. A third banner ran off the phone screen with EASY's longer hold
  (#100) — banners now stop where the room ends.
- **Pause menu at 150%:** ten items overflowed (#101) — rows compress.

## 5. Other perspectives

| Perspective | Result |
| :-- | :-- |
| Reduced motion (`reducedMotion: 'reduce'`) | camera shake scale 0 |
| Busy late wave (7 contacts, streaks, bloom), EASY | p50 16.7 ms, p95 16.8 ms |
| Colour-blind palette | never locked; contrast tests over all palettes pass |

## 6. Build

296.2 kB raw / 97.1 kB gzip (v2.0.0: 284.7 / 93.4). Zero runtime dependencies.
