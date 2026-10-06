# Hand-over — Carrier Vector: 1988 at v2.3.0

For whoever picks this project up next - a person or an agent. Read this
page, then the [CHANGELOG](../CHANGELOG.md) entry for 2.3.0, then
[`reviews/v2.3.0/`](reviews/v2.3.0/README.md). Everything below was true on
2026-10-06.

---

## 1. Where it stands

| | |
| :-- | :-- |
| Version | **2.3.0 "Bring a Friend"** (`package.json`, stamped on the briefing, the crash screen and every feedback report) |
| Live | <https://bejranonda.github.io/carrier-vector-1988/> - GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `master` (typecheck, tests and build must pass first) |
| Tests | **1,228** headless (Vitest, 72 files), **81/81** browser checks (`npm run playtest`), balance sim unchanged since v2.2.0 |
| Bundle | 330.0 kB JS, 109.4 kB gzip; **zero runtime dependencies** (a rule, not an accident - `GUIDELINES.md` §1) |
| Humans who have played it | **None in a structured test, seven releases running.** Every score in the reviews is the implementer's |

What the game is now, in one breath: a browser jet game whose front door is
**SCRAMBLE** (airborne in a second, waves of bombers, kill chains, three
stars a mission, a career), with **EASY** flying for non-gamers and older
players (the plane flies itself, one button fires) and a **share loop**
(v2.3.0): a challenge link that opens on "ANNA CHALLENGES YOU", the same
waves, the score to beat on the HUD, and a REPLY at the end. Behind it, the
original deck-management and 6-DOF sortie game is intact.

## 2. Run it, check it

```bash
npm ci
npm run dev        # http://localhost:5173 - window.__game, __ui, __sfx handles in dev
npm run typecheck
npm run test       # 1,228 tests, ~35 s
npm run playtest   # 81 checks in headless Chromium, screenshots in playtest-output/
npm run balance    # ~2 min: 16 deterministic SCRAMBLE runs, two bot profiles
npm run build      # dist/ and dist/c/index.html (the challenge page)
```

- `npm run playtest` needs Playwright's Chromium. In the cloud container it is
  at `/opt/pw-browsers` already; never run `playwright install` there.
- A challenge link to try locally: `http://localhost:5173/c/?c=424242.5000.3.e#n=Anna`
  (`.e` = flown on EASY; drop it to see a newcomer asked how to fly).
- `npm run balance` is deterministic (seeded `Math.random`). After any change
  that should not touch gameplay, its two summary rows must be identical:
  `easy-hold` 40.6 kills / 19,146 mean score, `std-steer` 10.4 / 3,547.

## 3. Where things live

`README.md` → *Architecture* has the full file map. The parts you will touch:

| Area | Files |
| :-- | :-- |
| The orchestrator | `src/core/GameLoop.ts` (≈4,300 lines - phases, input routing, SCRAMBLE, debrief data, share state). Big on purpose: its seams are the pure modules below |
| SCRAMBLE | `core/Scramble.ts` (waves, bonuses), `core/Combo.ts`, `core/Medals.ts`, `core/Career.ts`, `renderer/DebriefView.ts` |
| EASY flying | `core/EasyMode.ts`, `renderer/FlyStyleView.ts`, `core/Platform.ts` + `renderer/TouchLayout.ts` (phone controls) |
| Share loop (v2.3.0) | `core/Challenge.ts` (links, `cleanPilotName`), `core/ShareCard.ts` (what a share says), `core/Share.ts` (share sheet / clipboard / quick links), `core/PilotName.ts`, `renderer/ChallengeView.ts` (the friend's first screen), `renderer/ShareImage.ts` (the 1080 picture), `ui/SharePanel.ts` + `index.html #share` (the panel, plain DOM), `vite.config.ts` (`challengePage` emits `/c/`) |
| HUD | `renderer/HUD.ts`, `renderer/HudLayout.ts` (instrument solver), `core/HudDensity.ts` |
| Tests that matter most | `core/GameLoop.smoke.test.ts` (drives real runs through a stubbed canvas), `scripts/playtest.mjs` (a real browser) |

Reference: `docs/KNOWLEDGE.md` (§25 is the share loop, rule by rule),
`docs/GUIDELINES.md` (rules learned from bugs - §18 is sharing),
`docs/APPROACH_AND_METHOD.md` (how each release was made - §16),
`docs/KNOWN_ISSUES.md` (#1-#139, open work in the table at the top).

## 4. What is open

In priority order (detail in `reviews/v2.3.0/RECOMMENDATIONS_AND_ROADMAP.md`):

1. **The share loop on real phones and real chat apps.** Every share was
   driven up to the call that opens the share sheet; what WhatsApp, LINE,
   Messages and Messenger do next is research, not measurement. Also
   unverified: Facebook's handling of `/c/` (#130, needs the live page in the
   Sharing Debugger) and saving the picture by long-press on an iPhone.
2. **People.** A pilot-customer round - eight people, four over 50, two who
   do not play games - in pairs, one sharing and one receiving. SCRAMBLE's
   difficulty and star thresholds are calibrated against bots (#97).
3. **"Add to home screen"** for phone players (manifest + icons).
4. Phone menus at large text (#103) and a type-scale pass (#104).
5. Owner decisions: a shorter address of the game's own (roadmap N5); a
   daily "beat the world" link (N3).

Deliberately not to do: rewards for sharing, a prompt after every run, an
automatic share sheet, anything that needs a server or an account.

## 5. Traps (each one has bitten)

- **A share sheet opens only inside the tap.** No `await` before
  `navigator.share()`; the picture is encoded when the panel opens.
- **The challenge link goes in `text`, never `url`**, and the picture goes
  in a second share - chat apps keep one item of a mixed share.
- **A phone's tap is followed by its click** on whatever is under the finger
  now; the share panel ignores clicks for 500 ms after opening.
- **A mouse press focuses the canvas** (it has `tabindex`) after your handler
  ran - take focus back on the next task. Keys reaching `window` while the
  panel is open go to `SharePanel.strayKey`.
- **Panel state outlives a run** unless cleared on open (the second share
  once showed the first run's picture).
- **Measure text the way the screen will**: the welcome screen wraps by
  monospace width with CJK as a full em; never cut a name.
- **`tsconfig` has `erasableSyntaxOnly`**: no parameter properties or enums.
- **Vitest picks up any `*.test.ts`** under the project - keep scratch tests
  out of the tree.
- **Do not trust a source-reading review alone.** v1.9.0 onwards: run the
  build in a browser and look at the frames; v2.3.0's code review found
  focus and state bugs no screenshot shows, its UX review found a sentence
  that reads like a scam.

## 6. How a release is made here

1. Work on a branch; keep `npm run typecheck`, `test`, `playtest`, `build`
   green, and `balance` identical unless gameplay changed on purpose.
2. Update: `CHANGELOG.md`, `README.md` (badges, counts, the feature text),
   `docs/KNOWN_ISSUES.md` (status table + new entries), `docs/KNOWLEDGE.md`,
   `docs/GUIDELINES.md`, `docs/APPROACH_AND_METHOD.md`, `docs/PLAN.md`, a
   `docs/reviews/vX.Y.Z/` suite and its row in `docs/reviews/README.md`, and
   this page.
3. Bump `package.json`; merge to `master` (that deploys Pages); tag
   `vX.Y.Z` on the merge commit.

## 7. Release history in one table

| Version | Name | What it was |
| :-- | :-- | :-- |
| 1.9-1.11 | Browser playtest, pilot menu | First reviews run in a real browser; HUD collisions, a pause menu that explains |
| 2.0.0 | SCRAMBLE | The arcade front door, chains, stars, career, FLY AGAIN, the daily |
| 2.1.0 | Every Pilot | EASY flying, text size, plain words |
| 2.2.0 | Second Look | Three code reviews, long balance runs, phones as a one-button game |
| 2.3.0 | Bring a Friend | The share loop at both ends, reviewed twice and fixed |
