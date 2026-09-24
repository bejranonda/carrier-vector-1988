# v1.10.0 — Playtest Evidence

Measurements only. No opinions. Compare with
[`../v1.9.0/PLAYTEST_EVIDENCE.md`](../v1.9.0/PLAYTEST_EVIDENCE.md).

* **Build:** `v1.10.0`
* **Tests:** 989 passed / 0 failed / 55 files · `tsc --noEmit` clean
* **Bundle:** 246.2 kB raw / 79.6 kB gzip · 0 runtime dependencies
* **Harness:** `npm run playtest` (and `PLAYTEST_SLOW=1`) — headless Chromium
  1194 via `playwright-core`, own Vite dev server, fresh profile per session
* **Production smoke:** the `GITHUB_ACTIONS=1` build served under
  `/carrier-vector-1988/` — desktop and phone: 0 page errors, 0 failed requests,
  dev handle stripped, advances past the briefing on keyboard and on touch

---

## 1. Harness results — 28 / 28

| Check | Result |
| :-- | :-- |
| New pilot routed to the training sortie | ✅ `TRAINING_SORTIE` |
| New pilot on the FIRST_FLIGHT HUD | ✅ |
| Briefing offers a pre-filled feedback link; hidden in flight | ✅ ✅ |
| Idling 40 s on the training deck costs the carrier nothing | ✅ hull 100 (was 85 at T+20s in v1.8) |
| Catapult launch → airborne | ✅ |
| No routine hint contradicts the climb-out order | ✅ hint `null` under `CLIMB TO 2,500 FT` |
| No trap-speed nag on the climb-out | ✅ |
| Held bank on default settings | ✅ **12.3 °/s**, nose **+6°** |
| Hands-off pilot comes out of afterburner | ✅ throttle 1.00 |
| `U` steps FIRST_FLIGHT → ARCADE | ✅ |
| Pilot with a completed mission graduates to ARCADE | ✅ |
| Phone 844×390 and 640×360: FLY → deck → LAUNCH → airborne | ✅ ✅ |
| Phone: thumb chaff button releases chaff | ✅ 12 → 11 (both sizes) |
| Phone portrait asks to rotate | ✅ |
| A persistent frame failure shows the crash screen, with a report link | ✅ ✅ |
| No page errors (every session) | ✅ |

## 2. Flight model, before and after

Held input, 2,500 m, 200 m/s start, unit-level (`AircraftPhysics`, turn assist on).

| Case | v1.9.0 | v1.10.0 SIM (1.0) | v1.10.0 ARCADE (1.7) |
| :-- | --: | --: | --: |
| Bank only, 16 s — turn rate | 8.0 °/s | 9.1 °/s | **11.2 °/s** |
| Bank only, 16 s — nose pitch at end | **+43°** | −10° | −6° |
| Bank only, 16 s — altitude change | −146 m | −284 m | −126 m |
| Bank + pull, 8 s — turn rate | 10.3 °/s | 11.7 °/s | **14.3 °/s** |

In the running game (harness, held `A`, default settings): **12.3 °/s**.

The v1.9.0 nose-up figure is the defect: the nose sat 43° above a descending
flight path. Honest note: on SIM the fix trades the climbing spiral for a
descending turn, because that airframe cannot make the 3.9 g a level 75° turn
needs — which is physically correct and is why ARCADE flies the bigger wing.

## 3. Recovery assist, entry 9 km astern at 900 m, 150 m/s

| | Hand-over speed | AoA at hand-over | Glideslope error | Outcome |
| :-- | --: | --: | --: | :-- |
| v1.9.0, SIM airframe | 95 m/s (still decelerating at idle) | 8.6° | **34 m low** | passed a 60 m / <95 m/s test by a hair |
| v1.9.0 law, ARCADE airframe | — | 10.8° | 51 m low | **flew into the sea 900 m short** |
| v1.10.0, SIM | 88 m/s (clamped) | 9.6° | **< 1 m** | hand-over |
| v1.10.0, ARCADE | **76 m/s** | **7.6–8.0°** (indexer on-speed) | **< 1 m** | hand-over |

Smoke test now asserts < 20 m, < 90 m/s, never below 30 m, on both airframes.

## 4. Screen inventory, 1440×900, a new pilot

| | v1.8.0 | v1.9.0 | v1.10.0 FIRST_FLIGHT |
| :-- | --: | --: | --: |
| Element pairs sharing pixels | 4 | 0 | 0 |
| Optional HUD regions shown (`visibleRegionCount`) | 8 (no horizon) | 9 | **3** (horizon, armed-weapon chip, hint line) |
| Bottom-of-screen items | 9 pills + 10 keycaps | 9 pills + 10 keycaps | **1 chip + 1 line** |
| Compass / radar | yes / yes | yes / yes | no / no — replaced by one steering cue |
| Deck panels shown first | 8 | 8 | **4** |
| Numbers on the first deck screen | ~35 | ~35 | **~8** |

## 5. Click and touch geometry

| Check | Before | After |
| :-- | :-- | :-- |
| ARCADE pill clicks vs. drawn pills | ASSIST/REWIND/PADLOCK 104 px off | identical rects (tested) |
| PRO corner buttons, chips | different x; chips fixed vs. measured | one solver each (tested) |
| Removed keycap strip | — | no click areas left behind (tested) |
| Touch: chaff | none | button above TGT, all 7 handsets, no overlap |
| Touch: HARM | none | 4th weapon slot, all 7 handsets, no overlap |
