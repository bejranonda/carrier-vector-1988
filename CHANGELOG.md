# Changelog

All notable changes to Carrier Vector: 1988.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] — 2026-09-21

**"Fight Back."** A playtester asked three questions - how do I defend against a missile, how do I
kill a SAM, shouldn't arrow-up pitch down - and all three turned out to be missing features, not
misunderstandings. This release answers them, and fixes a tutorial that had never worked.

### Added

- **Chaff (`X`).** Twelve cartridges a sortie, always breaks every SAM lock on you, with a recycle
  delay so it cannot be held down. A decoyed site cannot re-launch while the cloud is up. There were
  no countermeasures of any kind before.
- **A SAM you can out-fly.** The missile used to overwrite its velocity toward you every tick - an
  unbounded turn rate, so no manoeuvre could ever work. It now flies lead pursuit with a turn limit
  of 0.25 rad/s, measured rather than guessed so that flying straight is fatal, an immediate break
  beats a distant launch, and a close one still needs chaff.
- **Time-to-impact** on the missile warning, and a distinct `X` on the RWR once a lock is broken.
- **AGM-88 HARM (`4`).** Locks the nearest radiating site, no boresight cone; goes ballistic if the
  site shuts down. IRON HAND's briefing now teaches HARM-first, bombs as the fallback.
- **Death post-mortem** on the failed debrief: what killed you, and one line of advice.
- **Stick flip on the briefing.** The flight-sim convention (`UP` = dive) is offered once before the
  first flight, until the setting has been touched.
- **Desktop mouse control** of the cockpit HUD and deck (`PointerInteractivity`), the ARCADE/PRO
  HUD toggle and pitch inversion - all of which sat uncommitted since 1.4.0.

### Changed

- **One screen style.** CLEAN / MODERN / RETRO CRT behind `P` is gone; MODERN is the only look.
  A value stored under the old ladder falls back to it.
- **The training sortie cannot kill you.** The wingman hauls the jet clear of the sea, and fuel never
  drops below 1500 L. Near the boat only the last few metres count, so the glideslope lesson stands.

### Fixed

- **Nobody was routed to the tutorial.** `recommendScenario()` matched the six-step checklist flag,
  which belongs to CARRIER DEFENSE, so every first-time pilot was sent into endless waves over a live
  SAM belt. `TRAINING_SORTIE` now carries an explicit `isFirstFlight`.
- **The tutorial taught the wrong key.** It said `[A]` for autopilot in four places. `[A]` is roll
  left; the key is `[F]`.
- **The tutorial's drone never existed.** The opening timeline was empty, so the "splash the drone"
  step completed itself on a timer. A real target now spawns, and the autopilot step checks the
  autopilot instead of a clock.
- **Clicks landed on the wrong HUD pill.** The renderer and the hit-tester each computed the ARCADE bar
  geometry and had drifted 8 px apart. Both now use one solver, `solveArcadeBar()`.
- Eight type errors in the 1.4.0 work that vitest cannot see (it does not typecheck).
- The briefing accepted `1`-`9` while the control schema documented `1`-`5`.

### Guarded

- Two tests assert that every key named in mission prose exists in `CONTROL_SCHEMA` and is the key
  that actually performs the described action. Reintroducing the `[A]` bug now fails the suite.

### Known limitations

- Chaff and the HARM have no touch controls yet (KNOWN_ISSUES #44).

## [1.4.0] — 2026-09-20

Game feel and onboarding: a non-lethal `TRAINING_SORTIE` with the Ghost-Lead wingman, the cockpit
voice warning system, the padlock camera (`V`), vector-fragment explosions, camera shake and impact
flashes, and a 5-second time rewind (`BACKSPACE`, two per sortie).

## [1.3.0] — 2026-09-20

### Added

- **Rush the turnaround** (`R`, on the deck screen). The deck's one real
  decision was made once, in the seconds it takes to set fuel and ordnance,
  and everything after that was watching a progress bar with nothing left to
  choose. Rushing pushes the crew currently working the aircraft — the
  mechanic during maintenance and repair, fuel and ordnance crews during
  arming — past their ordinary pace: an immediate +20 task progress for -30
  stamina from each crew member, gated on their stamina being above a floor
  rather than a per-task lockout. The cost is real: the same crews keep
  working the task afterward at their now-lower stamina, and a rush also
  slows the *next* turnaround. A `R  RUSH IT` hint appears on the deck screen
  only while it would do something and disappears once the crew is spent —
  the stamina bars already say why.

### Known limitation

- The deck screen has never had full touch parity — the fuel/loadout keys
  (`1`-`4`) and the new rush key are keyboard-only, and a touch player loses
  nothing they had before. Recorded honestly in KNOWN_ISSUES §31 rather than
  left implicit.

## [1.2.1] — 2026-09-20

### Fixed

- **Nobody was told the colour-blind palette existed.** It shipped fully
  working in 1.2.0, entirely undiscoverable, behind `C` in the full control
  reference. The briefing's secondary options row now names it directly — `C
  try colour-blind palette` — for as long as the setting has never been
  touched, and the hint retires itself the instant it has, even to confirm
  `CLASSIC` is what the player wants. `Theme.storedPalette()` is the new
  primitive this rests on, and `renderer/BriefingScreen.briefingSecondaryOptions()`
  is the row's construction pulled out into a pure, tested function so which
  options appear — and in what order — no longer lives only inside a canvas
  draw call.

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
