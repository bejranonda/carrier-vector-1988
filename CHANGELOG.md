# Changelog

All notable changes to Carrier Vector: 1988.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-09-20

Six items off the open list: the autopilot learns to fly low, the phone learns
to land, and the palette, the map and the difficulty all become choices.

### Added

- **Terrain following** (`flight/TerrainFollowing.ts`, `G`, on by default). The
  autopilot samples the ground ahead and asks how high it must be *now* to
  clear each point by its set clearance when it gets there. It climbs the face
  of a ridge early, crosses with clearance, and sinks back into the valley
  instead of cruising at ridge height in plain view of the SAM belt. A
  replacement for the commanded altitude against a ground target, a floor only
  on an air intercept, and off entirely on an approach.
- **Recovery assist** (`flight/ApproachGuidance.ts`, `L`, or the `RCVY` button
  on a phone, where it is on by default). On final it holds the glideslope and
  the approach speed and hands the aeroplane back at short final. Lineup stays
  the player's, with a steer call on the glass, and so does the trap. Out of the
  approach corridor it is a cue — `RECOVERY — GET ASTERN OF THE BOAT` — rather
  than a hand-over; see KNOWN_ISSUES §29 for why.
- **Colour-blind palette** (`C`). Green instruments against red hostiles is the
  one pairing a deuteranope or protanope cannot separate; the alternative moves
  onto the blue-yellow axis — cyan instruments, amber hostiles, violet keycaps,
  and the two warning tones separated by lightness as well as hue.
- **Map choice on the endless mode** (`↑` / `↓` at the briefing). Holding the
  boat in a fjord, over open water and in a ridge field are three different
  problems. The scripted missions keep their own terrain.
- **Threat level** (`core/ThreatLevel.ts`, `V`) — `CADET` / `REGULAR` /
  `VETERAN`, which move a scenario along the escalation curve wave generation
  already implements. Not a score multiplier, and the daily forces `REGULAR`.

### Fixed

- **The stall limiter only knew one sign.** `isStalled` is `|alpha| >
  critical`, so the wing can let go at negative alpha — nose low and unloaded,
  which is where a descending turn puts it — and the limiter answered every
  stall with a push. Alpha went further negative, it pushed harder, and it flew
  the aeroplane into the sea with its own recovery law. Unloading now means
  moving alpha toward zero, whichever side of zero it is on.
- **The autopilot led with full rudder.** A large heading error meant full
  deflection held for seconds at 220 m/s, which does not turn the aeroplane, it
  departs it. The rudder is capped and follows the bank.
- **A stall did not always annunciate.** The caption appeared only when the
  limiter changed the demand, so a wing that let go while the stick was already
  where the limiter wanted it said nothing.
- **The Sidewinder's fallback seeker ignored line of sight**, so with nothing
  designated a missile could be sent after a contact behind a ridge. It takes
  the same visibility gate the scope does; a deliberate designation is still
  honoured whatever the terrain does next.
- **The autopilot fought the touch throttle**, putting power back a frame after
  a thumb had set it.
- **A contact range tag could land through the assist annunciator** on a phone.
  The band was never in the declutter keepout list because the caption used to
  be rare.
- **The briefing's options row clipped its first and last entries** at 800 px.
  It wraps now, and a wrapped block sits clear of the call to action.

## [1.1.2] — 2026-09-20

### Changed

- **Terrain masking now cuts both ways.** Target designation used to rank every
  live contact, launcher and strike target within 20 km whatever stood in
  between, so you could designate a SAM through a mountain and cycling the
  scope was free reconnaissance. `tactics/Visibility.ts` gates the candidate
  list on what the pilot can actually see, by class: a **structure** is always
  available (it is on the briefing card), an **aircraft** needs live line of
  sight (it moves, so a remembered position is a lie), and a **launcher** needs
  line of sight *or* to have been discovered already — seen once, or having
  painted you, since it does not move. Masking a ridge now hides the launchers
  from you as well as you from them, which makes climbing a real decision.
- Contact brackets and range tags follow the same rule, so the HUD no longer
  draws a bracket on something behind a hill.

### Performance

- Line of sight is a ray march, so it is re-evaluated at most every 120 ms and
  cached in between — except for a contact never yet evaluated, which resolves
  on the tick it appears, so a newly spawned package is designatable at once.

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
