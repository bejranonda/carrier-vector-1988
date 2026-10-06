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
| ENTER (PLAY - IT'S FREE) | Airborne on seed 424242, on EASY (Anna flew EASY), no fly-style question | PASS |
| In flight | The run chases 5,000, labelled ANNA | PASS |
| Pass 5,000 | "AHEAD OF ANNA!" on screen within the 2.5 s it may wait for a quiet beat | PASS |
| The debrief | Headline "YOU BEAT ANNA!"; the share button reads "REPLY TO ANNA" | PASS |
| C | The share panel opens with the picture encoded (1080 × 1080) | PASS |
| Type "Mike" | The name goes on the link (`#n=Mike`), the sound is not muted (M), the controls are not switched (K), the debrief stays | PASS |
| | The message ends with the link alone on its last line | PASS |
| ESC | The panel closes; the debrief is where it was | PASS |
| A mouse click on REPLY TO ANNA | The panel opens with the keyboard inside it, and ESC closes it (the code review found ESC dead here) | PASS |

Session `challenge-standard`, the same link without `.e`: ENTER asks a
newcomer how to fly; choosing EASY flies seed 424242 chasing Anna's 5,000 -
PASS on both.

## 2. A phone shares with a tap (session `phone-share`, 844 × 390, touch)

| Check | Result |
| :-- | :-: |
| A tap on SHARE opens the panel - and it stays open | PASS |
| With no share sheet (headless), WhatsApp, LINE and TEXT MESSAGE are offered; the picture is 1080 | PASS |

The first build failed the first check: the panel opened on the tap's
`pointerdown`, and the phone then delivered the same tap's `click` to the
panel's CLOSE button, which sat under the finger. Found by this session's
screenshot, fixed by ignoring clicks for half a second after opening.

## 3. Harness — 81/81

New since v2.2.0's 66: the checks above (challenge welcome, tab title, EASY
preset, score target, the banner, the debrief headline and reply label, the
panel and picture, name isolation and link, the message's last line, ESC, the
mouse-opened panel; the STANDARD link and its fly-style question; phone
tap-to-share and the no-sheet buttons), and the new session's own no-errors
check. The old "challenge link opens SCRAMBLE" check now opens the real `/c/`
link shape.

### The code review's findings, re-checked in a browser

Each finding was reproduced by the reviewer in Chromium; after the fixes a
scratch script drove the same scenarios against the working tree:

| Finding | Re-check | Result |
| :-- | :-- | :-: |
| Second share showed the first run's picture | Run 1 (3,000) shared, run 2 (9,000) opened: no picture of run 1 on show, SAVE disabled; then run 2's picture | PASS |
| ESC dead after a mouse click on SHARE | Focus inside the panel after the click and after the picture encodes; with focus pushed out, ESC still closes it and the debrief stays | PASS |
| A name typed just before COPY | "Zed" typed, COPY MESSAGE at once: the clipboard ends `#n=Zed` | PASS |
| IME ENTER | A composing ENTER is not cancelled and focus stays in the field | PASS |
| No picture after a failed share (phone, a sheet that refuses) | ALSO SEND OR SAVE THE PICTURE and SAVE PICTURE both shown | PASS |
| Double tap on the main button | Nothing said while the sheet is up; "Thank you for sharing!" once it closes | PASS |
| HUD score to beat at 568 × 320 and 720 × 433 | `HULL 100%   TO BEAT 5,000 · YOU 0` between the thumbs; the chip `BEAT 5,000 · YOU 0` beside the objective, not over it | PASS (screenshots) |
| A 16-character CJK name upright | "山田太郎山田太郎山田太郎山田 / CHALLENGES YOU", set smaller, inside the panel | PASS (screenshot) |
| iPhone long-press on the picture | `-webkit-touch-callout: default` is in the stylesheet; Chromium drops the property, so this needs a real iPhone | not measurable here |

## 4. Screens

| Screen | Before (v2.2.0) | After |
| :-- | :-- | :-- |
| Challenge link, 1280 × 720 | Mission select; one line of small yellow text | "CARRIER VECTOR: 1988 · A FREE JET GAME", "ANNA CHALLENGES YOU", 5,000 PTS in gold, two balanced lines on the waves, PLAY - IT'S FREE, "No download, no sign-up..." |
| Challenge link, 390 × 844 upright phone | Same, smaller | Every line wrapped inside the panel, "Turn your phone sideways to play." |
| Challenge link, 844 × 390 phone | Same, smaller | The compact layout, one sentence on the game, every element on screen |
| In flight, passing the score | Nothing | "AHEAD OF ANNA! / PAST 5,000 PTS - KEEP IT UP"; chip "YOU 5,100 · AHEAD OF ANNA" |
| Debrief after beating it | Red "CARRIER LOST · WAVE 2", grey "CHALLENGE BEATEN by 55 pts." | Gold "YOU BEAT ANNA!", "YOU 5,100 · ANNA 5,000 - you won by 100!", "YOU BEAT ANNA - LET ANNA KNOW", REPLY TO ANNA lit |
| Share | 10-12 px text box, "C copy result" | Panel: picture ("MIKE BEAT ANNA!" over a MIKE / ANNA scoreboard), name, one main button, the message as it will be sent |
| Share panel, 568 × 320 phone | - | Picture beside the controls; CLOSE in the title row; the main button on screen |
| Share panel, 390 × 844 upright | - | Picture above; CLOSE beside the title, on screen without scrolling |

## 5. Unit and integration tests

1,228 tests (v2.2.0: 1,185; twelve tests of the removed text-card formatters
went with them). New: `Challenge` (names after `#`, cleaning - look-alike
dots, invisible letters, every kind of space, accent towers, Thai and Tibetan
kept whole - a Thai round trip, an encoded apostrophe), `ShareCard` (every
message branch, plurals, no "0 planes", no symbols or shouting), `Share`
(payload shapes, outcomes including BUSY, clipboard, quick links),
`ShareImage` (crop maths, every word inside the square and at least 30 px, the
scoreboard, a long headline shrunk not cut), `ChallengeView` (layout at ten
sizes including upright phones, CJK and long names, balanced lines),
`DebriefView` (three buttons at eight sizes, none overlapping),
`HUD.scoreWithTarget` and its shorter options, `PilotName`, and nine GameLoop
integration tests for the whole loop (a first run shared as an invitation, a
moment dropped when the menu held it back, the welcome's close hook).

## 6. Build

330.0 kB, 109.4 kB gzip (v2.2.0: 305.7 / 100.8) - the picture renderer, the
welcome screen and the share panel. `dist/c/index.html` is emitted with the
challenge preview text and without `og:url` or `canonical`, with the
`GitHub Pages` base path too; the build now fails if either tag survives
(checked against a page with its attributes reordered). Zero runtime
dependencies.
