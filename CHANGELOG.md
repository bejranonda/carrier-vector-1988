# Changelog

All notable changes to Carrier Vector: 1988.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] — 2026-09-20

### Fixed

- **Warning banners flashed above the seizure-safety threshold.** The stall
  banner blinked at 4.5 Hz and the missile-launch banner at 3.8 Hz, against the
  WCAG 2.3.1 limit of three flashes per second. Every blink is now capped at
  2.5 Hz for all players.
- **`prefers-reduced-motion` was ignored on the canvas.** The CSS honoured it
  for the CRT flicker while the camera shake and full-screen impact flash —
  exactly the effects the preference exists for — did not. Reduced motion now
  turns the shake off and damps the flash, and leaves warnings lit rather than
  blinking.
- **The deck layout solver could draw an `essential` panel off-screen.** It
  grew panels to fill spare space but never squeezed them when there was none,
  so a panel it was not allowed to drop overflowed its own content box by about
  fifty pixels on a 320 px screen. Growing and squeezing are now one
  computation.
- The turnaround panel drew its progress bar through its own title once the
  solver squeezed it; it now sheds its blurb instead.

## [1.1.0] — 2026-09-20

The playable-everywhere release: three maps, a jet that can fly itself, a
target you can point at, a mix worth hearing, something to share, and a mobile
mode that opens the game to a phone.

### Added

- **Three maps** (`tactics/TerrainProfiles.ts`). BJORNFJORD (the original),
  NORWEGIAN SEA and KVITOYA RIDGES, each a height function plus a SAM order of
  battle, with navigability guarantees enforced by tests.
- **Flight assist levels** (`flight/FlightAssist.ts`). `MANUAL` / `ASSIST` /
  `AUTOPILOT` on `F`, as pure control laws feeding the same physics. `ASSIST`
  is the default.
- **Target designation** (`tactics/TargetDesignation.ts`). `T` cycles a
  priority-ordered scope; the designation drives the HUD bracket, the weapon
  recommendation, the Sidewinder's seeker and the autopilot's intercept.
- **Per-mission progression** (`core/MissionRecords.ts`). Best score,
  completions and attempts per scenario, a cleared tick on the selector, and a
  suggested mission to fly next.
- **Operational tempo** (`core/Pacing.ts`). `ARCADE` (default) and `SIM` on `O`.
  Briefing to first kill, measured in Chromium: **9.6 s** at `ARCADE`, against
  no kill inside a two-minute budget at the old timings.
- **Feel**: camera shake on a trauma model, cannon rounds that wound rather
  than instantly kill, kill callouts, an impact flash, and a trap that holds
  the cockpit and stamps the wire grade.
- **A real audio mix** (`audio/AudioMix.ts`). Every voice runs
  `[panner] → category bus → master → compressor → out`, with stereo placement
  and distance attenuation for world events, a threat drone driven by the RWR,
  airflow scaled by airspeed, and a pre-stall buffet.
- **The Daily Sortie** (`core/DailySortie.ts`). One date-seeded run everybody
  gets the same version of, with a four-line share card.
- **Mobile mode** (`core/Platform.ts`, `renderer/TouchLayout.ts`,
  `core/TouchInput.ts`). Thumb controls built on the autopilot and designation:
  a virtual stick that centres where your thumb lands, a throttle track, weapon
  pills, and **tap a contact to designate it** (on any device, mouse included).
- **HUD label declutter** (`renderer/LabelDeclutter.ts`).

### Fixed

- **The landscape was invisible on a phone.** The camera's focal length was a
  fixed 380 px that `resize()` never touched, so the angular field of view was
  a function of window height — ~100° on a desktop and ~46° on a 320 px
  handset. With the nose up, the entire world fell outside the frame. The angle
  is now the constant and the focal length is derived from the viewport.
- Contact range tags stacked on each other and over the altitude block in a
  dense merge.
- `setPointerCapture` could throw inside `pointerdown` and abort the handler,
  so the virtual stick and weapon pills registered nothing at all.
- A daily sortie was filed under the date it *finished*, so a run begun at
  23:59 landed on the wrong day against a seed it was never flown on.
- The deck panel solver overflowed a short screen; the turnaround progress bar
  drew outside its own panel.
- The debrief prompt drew through the share card, and the card overflowed a
  560 px-tall window.
- An aircraft glyph missing from the game's monospace font rendered as a stray
  arrow on the share card.

### Changed

- Gun balance: rounds do 25 damage inside a 12 m radius (about four hits for a
  fighter, nine for a bomber) instead of killing outright inside 18 m. The
  AIM-9 still kills outright.
- Enemy cannon fire has its own voice; it used to play the player's own gun
  sound, so being shot at and shooting were indistinguishable.
- The HUD and deck solvers take a reserve and shed content in touch mode rather
  than drawing over the thumb controls.

## [1.0.0]

Initial release: dual-loop carrier deck logistics and 6-DOF vector flight, five
selectable missions, CRT phosphor rendering, and zero runtime dependencies.
