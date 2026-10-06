# v2.3.0 — Playtest Evidence

Headless Chromium (Playwright) against the development build with the
`window.__game` handle, plus the headless test suite. **No humans, and no real
chat apps**: a headless browser has no system share sheet, so every share
below was exercised up to the call that would open it; what WhatsApp or
Messages then does with it is the research in `SHARE_REVIEW.md` §2, not a
measurement.

## 1. The loop, driven end to end (`npm run playtest`, session `challenge`)

A real link shape, `/c/?c=424242.5000.3.e#n=Anna`, opened in a fresh browser:

| Step | Check | Result |
| :-- | :-- | :-: |
| Open the link | "ANNA CHALLENGES YOU" is up; SCRAMBLE, seed 424242, score 5,000, name "Anna" loaded | PASS |
| | The tab title is "Anna challenges you - Carrier Vector: 1988" | PASS |
| ENTER (ACCEPT) | Airborne on seed 424242, on EASY (Anna flew EASY), no fly-style question | PASS |
| In flight | The run chases 5,000, labelled ANNA | PASS |
| Pass 5,000 | "YOU BEAT ANNA!" on screen at once | PASS |
| The debrief | Headline "YOU BEAT ANNA!"; the share button reads "REPLY TO ANNA" | PASS |
| C | The share panel opens with the picture encoded (1080 × 1080) | PASS |
| Type "Mike" | The name goes on the link (`#n=Mike`), the sound is not muted (M), the controls are not switched (K), the debrief stays | PASS |
| | The message ends with the link alone on its last line | PASS |
| ESC | The panel closes; the debrief is where it was | PASS |

## 2. A phone shares with a tap (session `phone-share`, 844 × 390, touch)

| Check | Result |
| :-- | :-: |
| A tap on SHARE opens the panel - and it stays open | PASS |
| With no share sheet (headless), WhatsApp, LINE and TEXT MESSAGE are offered; the picture is 1080 | PASS |

The first build failed the first check: the panel opened on the tap's
`pointerdown`, and the phone then delivered the same tap's `click` to the
panel's CLOSE button, which sat under the finger. Found by this session's
screenshot, fixed by ignoring clicks for half a second after opening.

## 3. Harness — 77/77

New since v2.2.0's 66: the eleven checks above (challenge welcome, tab title,
EASY preset, score target, the banner, the debrief headline and reply label,
the panel and picture, name isolation and link, the message's last line, ESC;
phone tap-to-share and the no-sheet buttons). The old "challenge link opens
SCRAMBLE" check now opens the real `/c/` link shape.

## 4. Screens

| Screen | Before (v2.2.0) | After |
| :-- | :-- | :-- |
| Challenge link, 1440 × 900 | Mission select; one line of small yellow text | Full-screen "ANNA CHALLENGES YOU", 12,345 PTS in 50 px gold, ACCEPT CHALLENGE |
| Challenge link, 844 × 390 phone | Same, smaller | The same card in a compact layout (no explanation line), every element on screen |
| Challenge link, 1280 × 720 EXTRA LARGE | Same | The card at 1.5×, everything on screen |
| In flight, passing the score | Nothing | "YOU BEAT ANNA! / PAST 12,345 PTS - KEEP GOING"; chip "12,400 PTS · AHEAD OF ANNA" |
| Debrief after beating it | Red "CARRIER LOST · WAVE 2", grey "CHALLENGE BEATEN by 55 pts." | Gold "YOU BEAT ANNA!", "By 55 pts - the carrier went down at wave 2.", "YOU BEAT ANNA - SEND IT BACK", REPLY TO ANNA |
| Share | 10-12 px text box, "C copy result" | Panel: picture, name, the device's share buttons, the message as it will be sent |
| Share panel, 844 × 390 phone | - | Picture beside the controls; CLOSE on screen |
| Share panel, 1280 × 720 EXTRA LARGE | - | Picture beside the controls (wide, short screens), text at 1.35× |

## 5. Unit and integration tests

1,215 tests (v2.2.0: 1,185; twelve tests of the removed text-card formatters
went with them). New: `Challenge` (names after `#`, cleaning, Thai round trip,
junk names), `ShareCard` (every message branch, plurals, no symbols or
shouting), `Share` (payload shapes, outcomes, clipboard, quick links),
`ShareImage` (crop maths, everything inside the square), `ChallengeView`
(layout at nine sizes including upright phones), `DebriefView` (three buttons
at eight sizes, none overlapping), `HUD.scoreWithTarget`, `PilotName`, and
six GameLoop integration tests for the whole loop.

## 6. Build

323.2 kB, 106.8 kB gzip (v2.2.0: 305.7 / 100.8) - the picture renderer, the
welcome screen and the share panel. `dist/c/index.html` is emitted with the challenge preview text
and without `og:url` or `canonical`. Zero runtime dependencies.
