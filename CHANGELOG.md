# Changelog

All notable changes to Carrier Vector: 1988.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] — 2026-10-06

**"Bring a Friend."** The owner's brief: *users should have a good experience,
they will love to share this to friends.* So v2.3.0 walked both ends of a
share in a browser - the player sending it, and the friend opening it - had a
research brief written on what chat apps actually do with a share, rebuilt
the loop around both people, then put the result through a UX review and a
code review and fixed what they found. Evidence:
[`docs/reviews/v2.3.0/`](docs/reviews/v2.3.0/README.md).

### The friend who opens the link (#127, #128)

- **"ANNA CHALLENGES YOU."** A challenge link opens on a screen of its own:
  what the game is ("CARRIER VECTOR: 1988 · A FREE JET GAME"), who sent it,
  the score to beat in big gold numbers, "They lasted 3 waves of planes on
  EASY. You get the very same ones.", one sentence on the game, and one big
  **PLAY - IT'S FREE**, with "No download, no sign-up. EASY mode flies the
  plane - you tap FIRE." under it (and "Turn your phone sideways to play." on
  an upright phone). SEE ALL MISSIONS opens everything else. It used to open
  the full mission menu with the challenge in one line of small yellow text.
  Every line wraps rather than being cut, in balanced lines; a long name in
  any script is set smaller. The browser tab and the canvas's screen-reader
  label say who sent it.
- **Same fight, one tap sooner:** a newcomer accepting an EASY challenge
  flies EASY without the fly-style question; a STANDARD challenge still asks.
- **The score to beat is on the HUD** as a scoreboard - `ANNA 12,345 · YOU
  4,200`, then `YOU 13,100 · AHEAD OF ANNA` - even on the first-flight HUD.
  Passing it is a moment: **"AHEAD OF ANNA!"** and a fanfare, once a run, in
  a quiet beat rather than on top of a kill banner. Not "YOU BEAT ANNA": the
  run is not over, and a penalty can still take the lead back.
- **A win is the headline.** Beating the challenge used to be a grey line
  under a red CARRIER LOST; it is now the debrief's headline, in gold - "YOU
  BEAT ANNA!" over "YOU 12,400 · ANNA 12,345 - you won by 55!" - and the share
  button reads **REPLY TO ANNA**.
- A run without a challenge chases the pilot's own best the same way:
  `BEST 8,000 · NOW 4,200`, then "PAST YOUR BEST!".

### The player who shares (#125, #126, #129, #131)

- **SHARE** sits beside FLY AGAIN (C on a keyboard). It lights up for a win, a
  new star, or a beaten best (once a session - not every run); otherwise its
  line just says what it does ("SHARE: YOUR FRIEND GETS THE SAME PLANES"). It
  used to be "C copy result" inside a small text box. A first run is not
  shared as a "best yet" - everyone's first run is one - but as an invitation.
- **The share panel**: the picture, an optional name ("so your friend knows
  it's you" - kept on this device), and ONE main button - CHALLENGE A FRIEND,
  REPLY TO ANNA, TELL ANNA or INVITE A FRIEND - through the share sheet. Once
  that has gone, the picture is offered as a second share ("ALSO SEND OR SAVE
  THE PICTURE"; on an iPhone the sheet's Save Image puts it in Photos). Where
  there is no share sheet (in-app browsers, Firefox, Linux): WhatsApp, LINE
  and a text message or email, with COPY MESSAGE; SAVE PICTURE, and COPY
  PICTURE on a computer. CLOSE sits at the top, where a dialog's way out is
  looked for.
- **The picture**: a 1080 square in the game's look and the pilot's palette,
  every word at least 30 px so it reads in a chat thumbnail - the game's name;
  a headline with names in it ("CAN YOU BEAT TOM?", "TOM BEAT ANNA!"); the
  run's best moment, brightened (a frame kept a beat after the best kill,
  before the thumb controls are drawn); the stars and the score - or, after a
  challenge, a two-row scoreboard; the numbers worth showing; and a footer
  band, "FREE GAME - PLAYS IN YOUR BROWSER", with the address.
- **The message**, in plain sentences with the link alone on its last line,
  addressed to the friend: "I beat your score, Anna! 12,400 to your 12,345 in
  Carrier Vector: 1988. Your turn to win it back - it's a free jet game in
  your browser, a few minutes:"; after a loss, "You're still ahead, Anna -
  15,000 to my 12,345... I'll get you next time!"; after a modest run, an
  invitation ("Try Carrier Vector: 1988, a free jet game - it plays in your
  browser, nothing to install. EASY mode flies the plane; you just press
  FIRE."). It says what the link is, for friends who are wary of links.
- **Two shares, not one.** The first build sent the picture, the message and
  the link together; the research showed iPhone WhatsApp drops the picture
  and Facebook/Messenger drop the link from such a share. The challenge goes
  as text (never as a share `url`, which some iPhone apps cut the query string
  from), the picture alone.
- **Nothing says "sent"** - the browser is only told an app was chosen, so the
  panel says "Thank you for sharing!".

### Links (#126, #130)

- `https://bejranonda.github.io/carrier-vector-1988/c/?c=seed.score.waves[.e]#n=Name`:
  the scheme, so every app makes it a link; `/c/`, the same page emitted by
  the build without the `og:url` and `canonical` that would send a Facebook
  post to the home page, and with preview text addressed to the friend ("Can
  you beat my score? Carrier Vector: 1988 - a free jet game" / "Plays in your
  browser. No download, no sign-up, nothing to pay...") - the build now fails
  if that page ever keeps them; the name after `#`, which never reaches a
  server, cleaned so it cannot read as a web address (look-alike dots,
  slashes and colons, and invisible "filler" letters, included), with an
  apostrophe encoded so a chat app's link finder does not stop at it.

### From the UX review

A reviewer walked both ends again as a non-gamer and an older player:

- The welcome screen cut "GRANDMA MARGARET CHALLENGES YOU" to "GRANDMA
  MARGAR..." on an upright phone - the way most links are opened. It wraps.
- The link preview said "You have been challenged", the shape of a scam text.
  It now asks a question and says what the link is.
- Two equal send buttons (the challenge and the picture) - people sent the
  picture and no link. One main button; the picture is offered after.
- "Card" meant nothing to a non-gamer ("Your name on the card"); a mid-run
  "YOU BEAT ANNA!" could be followed by "25 pts short"; a lit SHARE after
  every best felt like nagging. All fixed as above.
- The picture led with a score and hid the names; it now leads with them.

### From the code review

- A second share in a session showed - and SAVE PICTURE saved - the previous
  run's picture until the new one was drawn. The old one is cleared on open,
  and the picture buttons wait for this run's.
- ESC did nothing when focus had left the panel (a mouse click on SHARE ended
  by focusing the canvas; the quick links were rebuilt under the keyboard).
  Stray keys now reach the panel - ESC closes it, TAB goes back in - focus is
  taken back after a click, and the links are updated in place.
- A name typed less than a quarter-second before pressing a button was left
  off the link; ENTER confirming a Japanese or Chinese conversion was taken as
  "done". Both fixed.
- The HUD's score to beat ran under the FIRE button on a small phone and over
  the objective on a 720 px window. It now shortens to fit - the name first,
  never the pilot's own score.
- A long Chinese, Japanese or Korean name was measured as Latin text and cut.
- A failed share left a phone with no way to the picture; a double tap on the
  main button said "That did not work here" while the sheet was still open; a
  kill photographed just before opening the menu was replaced by whatever
  frame followed it. All fixed.

### Fixed on the way

- On a phone the share panel closed itself: it opened on the tap's
  pointerdown, and the same tap's click then landed on its CLOSE button.
- "5 WAVEs · 0 PLANEs DOWN" on the picture; "0 planes shot down" in a message.
- The SCRAMBLE debrief says PLANES SHOT DOWN (was BANDITS SPLASHED) and
  prints its bonus with a thousands separator.
- After a rotation prompt has waited four seconds, it mentions the phone's
  rotation lock.

### Removed

- The v2.0 text cards (`formatScrambleCard`, `formatShareCard`) and their
  "C copy result" box - replaced by the share panel.

### Engineering

- 1,228 tests (was 1,185; the twelve text-card tests went with the cards).
  Browser harness **81/81** (was 66): the whole friend loop from a real
  `/c/?c=...#n=Anna` link to a reply, a STANDARD link asking a newcomer how to
  fly, a mouse-opened panel closing on ESC, name isolation from the game's
  keys, and a phone tapping SHARE.
- Gameplay unchanged: `npm run balance` replays the same runs identically.
- Bundle 330.0 kB (109.4 kB gzip), was 305.7 / 100.8. Zero runtime dependencies.
- **`docs/HANDOFF.md`**, a hand-over page for whoever picks the project up:
  state, how to run and verify it (with the balance baseline), where the code
  lives, what is open, the traps, and how a release is made.

### Still open

Nothing here has been tried on a real phone or in a real chat app yet (#130
needs the live page in Facebook's Sharing Debugger); every challenge shares
the same preview card (#132, no server); and - seventh release running - no
human playtest.

## [2.2.0] — 2026-10-06

**"Second Look."** The owner asked: *validate anything to improve else?* So
v2.2.0 is a validation release: three independent code reviews of everything
v2.0-v2.1 added (about 40 findings, every one checked against the code before
it was fixed), eight-minute balance runs instead of three-minute ones, and a
phone-first pass for the players v2.1.0 was built for. Evidence:
[`docs/reviews/v2.2.0/`](docs/reviews/v2.2.0/README.md).

### The fight no longer stalls (#105, #106)

- **Enemy fighters stopped in mid-air.** The steering law blended the
  velocity toward a vector shorter than the speed, so every turn bled speed
  for good: after the first head-on pass a MiG fell from 185 m/s to 1-8 m/s
  and hung a kilometre below the jet until the wave timed out. Measured on
  EASY: **56% of all stalled wave time.** Fighters now turn at a capped rate
  (~16°/s, a little better than the player's held bank) and keep their speed,
  so they come back for another pass. This is the shared AI: every mission's
  fighters were affected. A south-bound contact also banked the wrong way.
- **...and then they sat on your tail.** Once they kept their speed, pure
  pursuit parked MiGs 50-300 m behind an EASY jet - inside missile minimum
  range, outside the gun cone - for most of a wave (the fixed AI's own stall
  log). A fighter that closes inside 450 m now breaks off and extends for 4 s,
  then comes round again: a **strafing pass**, with head-on shots both ways.
- **On EASY, FIRE NOW outranks "enemy behind you"** - a line that asks
  nothing of the pilot, and that held the coach for six seconds while a shot
  sat in the cone. Only a missile in the air (chaff) still outranks it. The
  stall this caused looked like an AI problem - a MiG circling on the jet's
  tail - and a break-off rule for tail-sitters was built for it first. Over
  8-16 seeds per profile that rule made every player worse; it was taken out.
- **Bombers flew away from the jet.** SCRAMBLE placed them off the nose; a jet
  that had drifted 8-11 km out, nose toward home, chased them from behind and
  never closed - **35% of stalled time.** Bombers now come in from the far
  side of the jet, so their run at the carrier passes it; and none appears
  within 2.5 km of the boat (one could spawn inside the strike radius and hit
  the carrier on its first tick).
- **Measured with `npm run balance`** - 16 seeds a profile, the same harness
  and seeds on both builds - v2.1.0 -> v2.2.0: EASY holding fire for 8 min,
  **26.9 -> 39.8 kills**, hull left 73% -> 87%; the STANDARD steering bot for
  8 min, **5.1 -> 10.0 kills**, runs shot down 16/16 -> 5/16; a relaxed EASY
  player who fires only when told, 3 min, **9 -> 17.1 kills**. Waves are
  counted more strictly now (#107) and the count still rose: 8.9 -> 10.3 on
  EASY.

### Waves mean what they say (#107, #108)

- **CLEARED / HELD / OVER.** A wave let through used to pay like one shot
  down - ~600 points, a WAVE CLEARED banner, and a step toward the CLEAR WAVE 5
  star; a run that never fired could earn it and a SUCCESS debrief. Now
  CLEARED (all shot down) pays the full bonus; HELD (some shot down, the rest
  reached the ship or turned for home) counts without the speed bonus; OVER
  (none shot down) does not count. The run carries on either way.
- **The jets a run allows are fixed when it starts.** Switching EASY off with
  three of five jets gone ended the run on the spot; switching it on part way
  still raises the count (the run is then marked EASY).

### Honest scores (#110, #111)

- **EASY is on the record.** A run flown on EASY - or with EASY switched on at
  any point - says so on its card (`SCRAMBLE · EASY`), on the daily card, in
  its challenge link (`?c=seed.score.waves.e`; old links still open), on the
  challenger's briefing (`FLOWN ON EASY`), in the verdict (`(they flew EASY)`)
  and on the debrief.
- **A SCRAMBLE day survived a reload** only in name: the stored record lost
  its mode, and a weaker second attempt printed the old deck card ("no trap")
  and saved it back that way.

### Phones, for the players v2.1.0 was for (#103, #115, #117, #118, #123)

- **EASY in SCRAMBLE shows one control.** It showed nine - stick, throttle,
  four weapon pills (two always empty), chaff, target, fire - plus a lit
  recovery button, while the plane flies itself, nothing fires a missile at
  the jet and there is no deck to go home to. Now: a FIRE button half as big
  again, which **lights up when a shot is good**, and the menu. **A tap
  anywhere on the world fires** too, like a mouse click. STANDARD in SCRAMBLE
  loses only what SCRAMBLE never uses; deck missions keep everything.
- **The game speaks to a thumb.** `FIRE NOW - TAP FIRE`, not `PRESS SPACE OR
  CLICK`; `(LEFT STICK)`, not `(A / D)`; `TAP THE MENU BUTTON`, not `PRESS
  ESC` - across the coach, the wave briefs, the pause menu and the "having a
  hard time?" offer.
- **Text size works on phones.** A phone is never zoomed (that crowded the
  cockpit), so the setting did nothing there; now LARGE and EXTRA LARGE grow,
  in place, the three things read in flight - the order strip, the coach line
  and the banners. On a phone the coach line also moved under the order
  strip: its old band was the middle of the screen, where the target is.
- **EASY hides speed and altitude** (numbers its pilot cannot act on) unless
  the PRO instrument set is chosen.
- **Share from the debrief.** A tap on the result card opens the phone's share
  sheet (or copies it) - a tap there used to fly again and throw the card away,
  so a phone could never send one. "Copied" now appears only once it was.
- **Upright phones**: the briefing, the fly-style question and the debrief take
  taps (they ignored every tap, with no prompt); the flight still asks you to
  turn the phone.
- **The pause menu fits a phone**: two columns where one does not (MISSION
  SELECT was off the bottom of an 844 × 390 screen).

### Fixed - big text on laptops (#112, #113)

- **Kill banners vanished at EXTRA LARGE on any laptop window under ~600 px
  tall**: below a 436 px layout no two-line banner was drawn at all - kills,
  WAVE, NOT YET, MAYDAY. The newest banner now always gets room.
- **The first screen collapsed at large text**: the FLY button sat on the
  phase cards and the options ran through it. The button now sits above every
  row of options, and the cards show only where they fit.

### Fixed - everything else the reviews found (#109, #114, #116, #119-#124)

- **HIGH: a jet's death carried into the next run** - RESTART during the
  MAYDAY sequence (or the daily from the menu) began the new run with dead
  controls, slow motion and a jet already written off.
- Text size switched the control scheme on large tablets (and with it the
  autopilot); safe-area insets went stale after a text-size change.
- EASY: the training checkout hid FIRE NOW for a whole deck sortie; a
  suppressed stall hint took FIRE NOW with it; the coach still said "come
  left", "descend into the canyon", "break turn"; the trigger promised a shot
  with a bomb selected, an empty gun or a ground target locked.
- A held ENTER answered the once-only fly-style question; a held E flickered
  EASY; the EASY mouse trigger stuck on after a release over the MENU button.
- The soundtrack played on in a hidden tab over a frozen game; a hidden tab now
  pauses the flight.
- RESTART turned the daily into an unrecorded random run; the debrief said
  SHOT DOWN when the carrier sank, with a stale "what got you"; VETERAN gave
  CARRIER DEFENSE wave stars for free; a rewind after a respawn put the new jet
  on the dead one's path; missiles could re-acquire through a ridge; a corrupt
  career save could freeze the briefing; the chooser came back every flight
  with storage blocked; the sim stepped a few times after the debrief opened;
  highlight glows never drew; `PRESS C TO CHANGE LOOKS` on the one screen where
  C copies.

### Link preview

- The page described itself as "6-DOF aerodynamics ... zero 3D engines" - and
  that is what a friend saw when a challenge link was pasted into a chat. The
  title, description and social cards now speak to players, and carry a
  1200 × 630 preview image rendered from the game.

### Engineering

- 1,185 tests (was 1,134). Browser harness **66/66** (was 61): EASY's
  phone controls, tap-anywhere fire, chaff kept in deck missions, an upright
  phone taking taps.
- **`npm run balance`**: whole SCRAMBLE runs through the real `GameLoop` with
  a stub canvas, 16 seeds per profile in a few minutes, `Math.random` seeded
  per run so any run replays exactly; `TL=1` and `DIAG_WAVE=n` for per-wave
  logs. It decided the strafing pass and threw out the tail rule.
- Bundle 305.7 kB (100.8 kB gzip), was 296.2 / 97.1. Zero runtime dependencies.

### Still open

#104 (small labels below the 28 px guideline), #97 (thresholds still
bot-calibrated, now with 16-seed eight-minute runs behind them), menus on phones are not
enlarged by the text size (#103, partly) - and, sixth release running, **no
human playtest**.

## [2.1.0] — 2026-10-06

**"Every Pilot."** The owner's brief: *players are not professional gamers,
and can be older people who are not good at technique.* v2.1.0 measures what
stops that player and removes it - without touching the simulation underneath.
Evidence: [`docs/reviews/v2.1.0/`](docs/reviews/v2.1.0/README.md).

**The measured wall.** A scripted "relaxed" player - slow reactions, never
steers, presses SPACE only when told - got its first kill in 5 s, then spent
minute after minute on `LOCKED - TURN TOWARD THE BANDIT`. Steering was the
barrier. Text was the other: almost every label was drawn at 9-12 px.

### EASY flying (`EasyMode.ts`)

- **The plane flies itself and aims for you; you decide when to fire.** The
  autopilot flies every intercept and the lock is always on.
- **A smart trigger** on SPACE, a mouse click or the FIRE button: the missile
  when a missile shot will land (and none is already on its way), the cannon
  when the target is close and on the nose, otherwise `NOT YET` with the reason
  in plain words. **Holding** it keeps firing whenever a shot is good - the
  game can be played with one button, or a mouse alone.
- EASY's missile cone is anything ahead of the wing line (90°), against the
  standard ~50° seeker cone; the coach says `FIRE NOW` exactly when the trigger
  would fire, and never asks an EASY pilot to steer or lock.
- **Forgiving:** world at 80% speed, half damage to you and from bombers to the
  boat, fighters miss more, five jets in SCRAMBLE, Sidewinders trickle back
  onto the rail, messages hold 1.7× longer, half the camera shake, no
  autopilot jargon (`ALPHA LIMIT`) on screen.
- **Measured, same relaxed player, 3 minutes:** STANDARD 6 kills / 4 waves;
  EASY 11 kills / 5 waves (first medal star); EASY holding fire 12 kills, on
  wave 6. No jets lost in any of them.

### Text size (`Theme.uiZoomFor`)

- **NORMAL / LARGE / EXTRA LARGE** (100 / 125 / 150%), on `T` from the very
  first screen, in the fly-style question and in the pause menu. Remembered.
- Implemented as a **UI zoom**, not a font multiplier: the first attempt scaled
  fonts alone and every fixed line height overlapped at 150%. Zooming lays each
  screen out for a smaller virtual viewport, so text, boxes and spacing grow
  together; it stops at a 720 × 400 virtual screen, so landscape phones (whose
  touch layout is already large) are not zoomed.

### "How would you like to fly?"

- **Asked once**, the first time a brand-new pilot presses FLY (or the daily,
  or skip): two big plain-language cards - EASY (recommended if you are new to
  games) and STANDARD - plus the text size. Keys `1` / `2` act at once,
  arrows + ENTER, mouse or a tap. A returning pilot is never interrupted and
  keeps STANDARD.
- Pause menu: `EASY FLYING: ON/OFF` (second item - where a struggling player
  looks) and `TEXT SIZE`. Briefing: `T text size`, `E EASY flying`.
- **"Having a hard time?"** A STANDARD pilot who loses two jets in one run is
  offered EASY once, in plain words (the guidelines' hint after repeated
  failure). Never repeated, never on EASY, changes nothing by itself.

### Plain words

- Instructions drop the jargon: `SHOOT DOWN 2 PLANES` (was `SPLASH 2
  BANDITS`), `FIRE NOW - PRESS SPACE`, `TARGET LOCKED - TURN TOWARD IT (A / D)
  UNTIL IT SAYS FIRE NOW`, `ENEMY BEHIND YOU - TURN HARD (HOLD A OR D)`, wave
  briefs such as `A BOMBER WITH GUARDS - SHOOT THE BOMBER FIRST`. Celebrations
  keep their flavour (`SPLASH ONE`).

### Fixed

- **#98** The fly-style keycaps only highlighted a card and waited for ENTER -
  found by the bot, which sat on the question for three minutes. They now act.
- **#99** The EASY coach turned `TARGET LOCKED ... UNTIL IT SAYS FIRE NOW` into
  `FIRE NOW` (the line contains the words) - caught by its unit test.
- **#100** Kill/wave banners could run off the bottom of a phone screen over
  the gauges; banners now stop where the room ends (oldest waits).
- **#101** A long pause menu on a short or zoomed screen ran out of its panel;
  rows now compress, dropping the detail line when they must.
- **#102** The menu offered `TAKE BACK THE STICK` while EASY made it do
  nothing; hidden while EASY is on.
- A held SPACE no longer auto-repeats missile or bomb releases through key
  repeat in STANDARD (the cannon is unaffected) - one press, one round.

### Engineering

- 1,134 tests (was 1,107), 66 files. Browser harness **61/61** (was 48): every
  new-pilot path answers the fly-style question; a new **older-player session**
  (EXTRA LARGE text, mouse only, EASY: 3 kills in 19.7 s holding the button,
  never told to steer, FLY AGAIN by click); phones tap the EASY card.
- Busy late wave (7 contacts, streaks, bloom): p50 16.7 ms, p95 16.8 ms in
  Chromium. Reduced motion: zero shake.
- Bundle 296.2 kB raw / 97.1 kB gzip (was 284.7 / 93.4). Zero runtime deps.

### Still open

#103 (phones cannot enlarge text - the zoom floor protects the touch layout,
and 84% of 50+ players play on phones), #104 (small labels stay below the
Xbox guideline's 28 px-at-1080p even at EXTRA LARGE), #97, and - fifth release
running - **no human playtest**, which for this audience matters most of all.

## [2.0.0] — 2026-10-06

**"Scramble."** A renovation of the player experience around one question the
previous eleven releases never asked directly: *would a stranger play this
twice?* The v2.0.0 review ([`docs/reviews/v2.0.0/`](docs/reviews/v2.0.0/README.md))
found a new player's first kill sitting behind a deck screen, a catapult,
"climb to 2,500 ft" and "engage the autopilot" - 13.9 s for a scripted pilot
obeying every order instantly, four different correct actions, and far longer
for a person reading them - and no reason in the game to come back after a run
except a bigger number. v2.0.0 puts the fight first and gives every run a
payout. **Measured in Chromium: first kill 4.2 s after pressing ENTER, one key.**

### SCRAMBLE - the new front door

- **A new first mission (#95):** airborne on the first frame, Sidewinders
  selected, a bomber auto-locked dead ahead. Endless waves that teach one idea
  each (fire / turn / they shoot back / kill the bomber first / check six /
  everything). The first two waves cannot fire; fighters' accuracy ramps with
  the waves. Wave clears rearm, patch and pay a speed bonus; bombers that reach
  the boat cost hull; three jets that respawn in the air. `Scramble.ts`.
  A wave that times out is survived but pays no bonus.
- **It can never stall:** every bandit is on the scope (AEW datalink), SCRAMBLE
  fighters hunt the player instead of wandering off to the boat, the lock
  re-acquires itself, and a wave alive after 75 s bugs out.
- **The daily is now a SCRAMBLE**, with its own card ("DAILY SCRAMBLE #n -
  WAVE 7 · 12,400 PTS · chain x4"), and **every** SCRAMBLE run leaves a
  pasteable card. Cards now end in the playable address, not a bare name.
- **Challenge links** (`Challenge.ts`): every SCRAMBLE card ends in
  `…/?c=<seed>.<score>.<waves>`. Opening it puts `CHALLENGE · BEAT 12,400 PTS
  (7 WAVES) ON THE SAME WAVES` on the briefing, flies the sharer's exact waves,
  and the debrief gives the verdict ("BEATEN by 600 pts" / "2,400 pts short").
  No backend.
- **A procedural synthwave soundtrack** for SCRAMBLE that layers up with the
  fight (`MusicPattern.ts`, scheduled in `SoundFX`), with its own `MUSIC`
  switch in the pause menu (remembered; effects unaffected).
- Selector order is the suggested path: SCRAMBLE, TRAINING SORTIE, then the
  campaign. `1`-`7` pick directly.

### Feel

- **Kill chains** (`Combo.ts`): kill again within 4.5 s for DOUBLE / TRIPLE /
  QUAD SPLASH and ACE STREAK, up to x5 - in every mission. One escalating
  banner instead of a stack (#92), a chain meter under the gunsight, a kill
  chime that climbs a whole tone per link.
- **Kill effects** (`KillFx.ts`): an expanding shockwave ring and the points
  earned (`+500 x2`) rising off the wreck, with a minimum on-screen size so a
  far kill still reads.
- **Hit-stop**: the world runs at 12% speed for 90-160 ms after a kill.
  Applied in the real-time loop only; the fixed-step simulation is untouched.
- **Speed streaks** (`SpeedStreaks.ts`): vector dust past the canopy, scaled
  with airspeed, thinned under reduced motion.
- The wave-clear payout waits a beat after the last kill so it does not land
  on the kill banner.

### Progression

- **Three named medal stars per mission** (`Medals.ts`), each earned on its own,
  shown on every selector pill with the next one to go for.
- **Career XP and levels** (`Career.ts`): every run pays score + a bounty per
  new star; NUGGET -> WINGMAN -> ... -> ACE -> LEGEND. Shown on the masthead
  and filled live on the debrief.
- **Unlockable palettes** priced in stars: AMBER VECTOR (3), ARCTIC WHITE (8),
  SYNTHWAVE (14). Equipped on unlock (never over the colour-blind palette,
  which is never locked); `C` cycles only what you own.

### Debrief

- **Rebuilt around FLY AGAIN** (`DebriefView.ts`): headline and post-mortem,
  stars popping in one at a time, a count-up score, a six-stat grid, the XP bar
  and any promotion, unlocks or the next-unlock teaser, the share card - then
  `ENTER FLY AGAIN` (same mission, straight back in) and `ESC MISSIONS`.
  Sections shed on short windows so a landscape phone keeps the XP bar.
  Input is held off for 0.7 s and key-repeat is ignored, so a held trigger
  cannot skip the payout.

### Fixed

- **#88** The six-step "hold W" flight checkout was pinned over every CARRIER
  DEFENSE run, veterans included, and its coach line replaced combat hints a
  minute into the fight. It now runs only for pilots who have completed nothing.
- **#89** "ON APPROACH - LINE UP WITH THE DECK" fired on every catapult
  climb-out (range-only check). It now needs the jet to be closing on the boat.
- **#90** The HUD and coach called a contact "IN RANGE - FIRE" at 8 km; the
  AIM-9 reaches ~3.8 km at a standing target. The envelope is now 3.5 km.
- **#91** On desktop, the deck screen's title was drawn under the DOM
  `MENU (ESC)` button.
- **#93** SPACE before a wave spawned launched Sidewinders at empty sky; the
  bot run emptied the rails before the first bomber appeared. No target, no
  launch (`NO TARGET`), and an empty rail falls back to guns (`GUNS`).
- **#94** A ripple-fired Sidewinder whose target died under it flew on blind -
  the bot log showed "misses" passing 3-7 m from a wreck. Rounds now
  re-acquire the nearest contact in a 45° cone.
- **#96** A share card could survive into the next, unrelated run's debrief.

### Measured, then reverted

- The review suspected the AIM-9's pure-pursuit guidance for a low bot hit
  rate. A headless sweep (80 geometries, cruising and hunting fighters) hit
  80/80 with both the old law and lead pursuit, so the guidance change was
  reverted; the real causes were #90, #93 and #94.

### Engineering

- 1,107 tests (was 1,029), 65 suites. Browser harness: **48/48** (was 33),
  rewritten for the new flow - airborne on ENTER, a kill within 10 s, the medal
  debrief and FLY AGAIN, a veteran spared the checkout, the training deck via
  key 2, the deck on phones, a challenge link flying the sharer's waves.
- Bundle: 284.7 kB raw / 93.4 kB gzip (was 253.6 / 82.0). Zero runtime deps.
- `KNOWN_ISSUES.md`: #88-#97. Review suite: `docs/reviews/v2.0.0/`.

### Still open, deliberately

#97 (SCRAMBLE difficulty and medal thresholds are calibrated against a crude
bot, not people), #53, #41, #82. **No new human has played this build** - the
fourth release running to say that the next step is five strangers and a
recorder, not more features.

## [1.11.0] — 2026-09-24

**"Click, Fly, Have Fun."** A desktop-focused fix round from four verbatim
complaints: no menu, no idea what to do, too many keys, and — mid-session —
"let user have fun to play too." Two of the three reported problems turned out
to be worse in the code than in the complaint: the game's own training-card
instruction stalled the jet at 85° of pitch, and the recovery assist could fly
the jet away from the carrier forever when asked to bring it home.

Evidence and the full story: [`docs/reviews/v1.11.0/`](docs/reviews/v1.11.0/README.md).

### Pilot menu

- **A real, clickable pause menu** (#83): `ESC`, a corner `MENU (ESC)` button
  (desktop, in flight and on the deck), or the touch `MENU` control (which
  used to just open the raw help overlay). Pauses the sortie; offers `LET THE
  AUTOPILOT FLY`, `TAKE ME HOME`, `SHOW ALL CONTROLS`, `INSTRUMENTS`, `SOUND`,
  `RESTART THIS SORTIE` and `MISSION SELECT`. Mouse hit-testing is built from
  the same rectangles the renderer draws (`PilotMenuView.pilotMenuLayout`).
- **The menu restates the current objective in plain words** (#84):
  "YOUR JOB NOW: CLIMB TO 2,500 FT — Hold W (or the up arrow) to raise the
  nose" instead of a keycap and a jargon phrase.

### Flight

- **ASSIST caps a held climb at ~35° of pitch** (#85). Measured: holding `W`
  exactly as the training card says reached 85° and near-stall speed in six
  seconds, because the alpha-based stall limiter is unloaded in a zoom climb
  and never engaged. `FlightAssist.climbLimited` fades a held pull out
  approaching the limit and gently pushes back over it. MANUAL is untouched.
- **"Take me home" takes you home** (#86). Measured: a jet 640 m astern of the
  carrier but pointed almost directly away, under the autopilot, was flown to
  7.9 km out and diverging. `ApproachGuidance` now also checks heading, and a
  jet in a good position but facing the wrong way gets a short, tight reversal
  back onto the final course instead of either holding its bad heading or
  routing via the same wide, ~11 km-radius turn a genuine long transit uses.
- **The training card's altitude readout matches the altimeter's units**
  (#87): both now read feet.

### Feel

- **Every scripted mission phase pays off** with an on-screen banner and a
  confirmation tone, reusing the radio callout text every scenario already
  had written rather than adding new copy (`Scenarios.shortCallout`).

### Engineering

- 1,029 tests (was 989), including a regression test that replays the exact
  measured "take me home" failure state and bounds how far the recovery may
  wander before converging.
- Browser harness: 33/33 checks (was 28/28) — five new checks for the pilot
  menu (visibility, pause, plain-language objective, click-to-resume).
- Bundle: 253.6 kB raw / 82.0 kB gzip (was 246.2 / 79.6).

## [1.10.0] — 2026-09-23

**"Built, Measured, Launch-Ready."** Implements the v1.9.0 review — after
measuring each recommendation first, which changed four of them — and prepares
the game for pilot customers. The headline is a physics defect no review had
found: directional stability acted about the world axis instead of the
airframe's, so a banked nose drifted up to 43° above a descending flight path.
That, not the roll, was *"I bank, I pull, nothing happens"*.

Evidence and the full story: [`docs/reviews/v1.10.0/`](docs/reviews/v1.10.0/README.md).

### Flight

- **Directional stability acts on sideslip about the body yaw axis** (#71).
  Identical wings-level; banked, the nose now tracks the flight path.
- **ARCADE flies a bigger wing** (`PacingSpec.liftScale` 1.7, lift and drag both
  scaled - no free energy). A held bank on default settings turns at **12.3 °/s
  with the nose at +6°** (was 7.2 °/s, nose climbing to 29°). The value is not a
  taste call: it is where the game's existing 70 m/s approach and 8.1° AoA
  indexer finally agree. SIM keeps the original airframe.
- **The recovery assist works** (#72). Rate-damped autothrottle; flight-path
  damping wings-level; a glideslope feed-forward; an approach speed derived from
  the airframe's on-speed AoA. It hands over **within 1 m of the slope** on both
  airframes - it rode 34 m low on SIM and flew into the sea on ARCADE.
- **Afterburner is a held boost in ASSIST** (#66): released above 180 m/s, it
  returns to military power. A throttle the pilot set is never touched.
- **One instruction at a time** (`Tutorial.arbitrateHint`): safety always speaks;
  routine coaching is silent while the objective is a non-attack order.
- **No TERRAIN alarm on a normal climb-out** (#77); **no "get astern of the
  boat" on take-off** (#78).
- **WASD by physical position** (#41): AZERTY, QWERTZ and Dvorak players get the
  stick keys under the same fingers. Mnemonic shortcuts keep their labels.
- **"Stick feels backwards?"** (#40, #48): four quick opposing pitch stabs offer
  the stick flip once, in context.

### HUD and deck

- **FIRST_FLIGHT HUD** (`core/HudDensity.ts`): a new pilot sees three optional
  regions - horizon, one armed-weapon chip, one hint line - instead of nine. A
  **steering cue** on a ring round the boresight (`BOAT 4.2 KM · TURN LEFT`)
  replaces the compass and radar (#54). Graduates to ARCADE after the first
  completed mission; `U` cycles FIRST FLIGHT / ARCADE / PRO and is remembered.
  Budgets are enforced by tests.
- **Missile carets** (#42): each missile in flight is a red chevron on the same
  ring - `MISSILE LEFT`.
- **Guns-tracking tone** (#59).
- **Brief deck** (#69): four panels for a new pilot, following the HUD density;
  the crew panel is folded into one line; the turnaround's stores rows are
  visible at last (#74).
- The ten-key cheat strip is gone; REWIND shows while it has charges, PADLOCK
  only with a designation.

### Fixed

- **Free ordnance** (#73): an empty magazine still produced bombs. The jet now
  launches with what the ship holds; the payload panel says `NONE ABOARD`.
- **Clicks landed on the wrong thing** (#75, #76): ARCADE pill clicks were 104 px
  off; PRO corner buttons and chips were hit-tested where they were not drawn;
  the deleted strip left invisible click traps. One solver per rectangle now,
  shared by renderer and hit-tester, and tested.
- **The training target is a drone everywhere** (#68): `DRONE` in the cockpit,
  `TRAINING RANGE · TARGET DRONE` on the deck.
- **Returning pilots open on the recommended mission** (#80).
- **Touch readouts drifted into the objective strip** (#81).

### Pilot-customer readiness

- **Touch chaff and HARM** (#44), in the thumb-layout test matrix for 7 handsets.
- **The loop survives a bad frame** (#79); a persistent failure shows a crash
  screen with Reload and a pre-filled report instead of a frozen image.
- **Versioned feedback link** on menu screens (pre-filled GitHub issue with
  build, browser and screen size - the player reviews it before sending); the
  build number on the briefing.
- **`WINGS EARNED`** on completing the training sortie (#55).
- Page metadata points at the live game; no broken large-image card.

### Tooling and docs

- **`npm run playtest`** (`scripts/playtest.mjs`, `playwright-core` dev
  dependency): 28 browser checks across desktop, laptop, two phones, portrait and
  a forced crash. Not in the deploy gate (wall-clock timing); run before release.
- Tests: **933 → 989**. Bundle: 79.6 kB gzip (+3.8 kB). Zero runtime deps.
- `KNOWN_ISSUES.md`: status summary; 17 closed; #71–#82 added (11 fixed, #82
  open). `GUIDELINES.md` §14, `APPROACH_AND_METHOD.md` §12, `KNOWLEDGE.md` §21.

### Still open, deliberately

#53 (1-D fjord - new content), #41's remap screen (P2), #82 (SIM approach speed
clamped), and the deck loop's depth (owner decision). **No new human has played
this build** - the next step is a pilot-customer feedback round, not a feature.

---

## [1.9.0] — 2026-09-21

**"Look at the Pixels."** The first release driven by an *instrumented browser
playtest* rather than a source review. A playtester said *"there are a lot of
info on the screen, I do not know what to do"* and *"it is hard to understand how
to control the jet"*. Running the live build in headless Chromium and looking at
actual rendered frames found that they were being generous: **four pairs of HUD
elements were being drawn into the same rectangle**, the default HUD had no
artificial horizon, the game's most-seen coaching hint was wrong on every launch,
and the "zero combat hostiles" tutorial was taking 15% off the player's own
carrier. 921 tests were green throughout — none of them looked at pixels.

Full evidence, with measurements: [`docs/reviews/v1.9.0/`](docs/reviews/v1.9.0/README.md).

### Fixed

- **Four HUD collisions, all unconditional at the default desktop size.**
  - The **objective strip** (54–108 px) and the **compass tape** (76–108 px) were
    the same pixels. The mission order and the heading numerals printed through
    each other character by character, on every frame, at every resolution.
  - The **arcade pill bar** (848–882), the **assist annunciator** (848–870) and
    the **keycap cheat strip** (~873–883) shared one 35 px band across the bottom
    of the screen.
  - The **score chip** (18–44) was drawn underneath the **DECK / HUD / STICK
    button row** (16–44), so the player's score and rank were never visible on
    desktop.
  - **Help-overlay labels** used an unbounded `fillText` and ran into the next
    column's keycaps (`…you do not need it to[O]urn)`).

  `HUD.BAND` and `HudLayout.BOTTOM_STACK` are now **derived** — each band's top is
  its predecessor's bottom plus a gap — and exported as `bandRects()` /
  `bottomStackRects()`. Six new tests assert both stacks are pairwise disjoint at
  every viewport height and every touch reserve, so the class of bug cannot come
  back silently.

- **The default HUD had no attitude reference.** `drawPitchLadder` returned
  immediately in `ARCADE` (the default) to "keep the center clean" — which also
  deleted the ladder's zero rung, i.e. the artificial horizon. A jet in a 75°
  bank with the real horizon off-screen had nothing on the glass to fly by.
  `drawArcadeHorizon` restores the horizon bar and a signed pitch number, using
  the same exact `fov · tan(δ)` projection so it sits on the true horizon, pinned
  and dimmed when the horizon leaves the screen. Nothing else from the ladder.

- **`TOO FAST FOR THE TRAP` fired on every launch.** The rule was
  `distanceToCarrier < 2500 && airSpeed > 95` — true by construction for the
  first seconds of every catapult shot ever taken. Measured 4 s after the
  training cat shot at 201 m: the objective strip read `CLIMB TO 2,500 FT` and
  the hint 60 px below it read `REDUCE TO BELOW 90 M/S`. Obeying it stalls the
  jet. The rule now also requires closing on the carrier, low altitude, and a
  non-climbing vertical speed.

- **The training sortie was shooting the player's carrier.** `TRAINING SORTIE`
  declares `combatShielded: true`, a tagline of *"Zero combat hostiles"* and a
  loss condition of *"Running out of fuel or ditching in the fjord"* — and took
  CV-68 from 100% to 85% hull at T+20s while a first-time pilot read the deck
  screen. `combatShielded` was checked in four places in `GameLoop`, all
  protecting the player's *aircraft*; `DeckManager`'s own damage path never
  consulted it. It does now, and a shielded contact logs a completed drone pass
  instead.

### Changed

- **Every control label shortened** at the single source of truth
  (`src/core/Controls.ts`). The longest was 57 characters and did not fit its own
  column in the help overlay. This propagates to the overlay, the briefing and
  anything else derived from the schema.
- **The review framework cut from 25 dimensions to 12.** It had grown
  10 → 12 → 15 → 21 → 25 across five reviews, in direct violation of the repo's
  own standing rule #8. Breadth had been purchased with depth: 3,438 lines of
  review across 20 files, and not one of them noticed the compass tape was being
  printed inside the objective strip. See
  [`REVIEW_TEMPLATE.md`](docs/reviews/REVIEW_TEMPLATE.md).
- Three new standing rules for reviews (#12–#14): a review without a rendered
  frame is not a review; every review must propose more deletions than additions;
  fix count beats finding count.

### Documentation

- New review suite [`docs/reviews/v1.9.0/`](docs/reviews/v1.9.0/README.md):
  suite index, **`PLAYTEST_EVIDENCE.md`** (measurements only, zero opinions),
  the 12-dimension review, a roadmap ranked by impact ÷ LOC, and a frank
  critique — including of the review prompt itself.
- `KNOWN_ISSUES.md`: issues **#61–#70** added with measurements. Two existing
  defects corrected — two different sections were both numbered `## 1.`, and §2
  had claimed since v1.7.0 that *"pitch is clamped to ±88°"* when that clamp had
  been replaced by `foldPastVertical()` two releases earlier.
- `GUIDELINES.md` §9 strengthened (vertical bands are derived, a reservation only
  one consumer honours is not a layout) and §13 added — ten rules, each encoding
  a bug that shipped.
- `APPROACH_AND_METHOD.md` §10–§11: the instrumented playtest method, and layout
  as a testable invariant revisited.
- `KNOWLEDGE.md` §20: measured flight and HUD constants — turn rates by assist
  law, the degenerate vertical-plane turn, roll onset, both band stacks, and the
  screen inventory.
- `README.md`: the control table's claim that it *"cannot drift from the code"*
  was never true (the prose is hand-written) and is now stated accurately.

### Measured, and deliberately NOT changed

- **Turn rate: 7.2–10.3 °/s**, a 180° reversal in 17–25 s, with the roll snapping
  to its 75° cap in ~0.45 s and pinning there. This is the mechanical root of
  *"hard to control the jet"* — and it is the number every mission's timing
  budget is built on, so changing it is the owner's call, not a reviewer's.
  Three options in Known Issues #65; the recommended one (ease the roll to the
  cap over ~0.4 s) changes no mission timing.
- **The anti-stall throttle floor never retards**, so a pilot who touches no
  throttle key flies the whole sortie at 150% afterburner (#66).
- **Bank-and-pull genuinely does out-turn bank alone** (7.2 → 9.5 °/s). This was
  investigated as a suspected bug and the measurement cleared it; the control
  reference is correct.

### Not fixed — the actual remaining problem

The screen still draws ~27 regions, 33 labelled values and 29 key bindings. The
fix is **R1, the `FIRST FLIGHT` HUD**: horizon, speed, altitude, one objective
line, one key hint, nothing else, on by default until the first sortie is
complete. Every component already exists and is already conditional somewhere;
it is a visibility predicate, roughly 150 lines. Thirteen consecutive
"make it easier for beginners" features have all *added* something to the
screen. The next one has to subtract.

---

## [1.8.0] — 2026-09-21

**"Entertainment, Visceral Impact & Beginner Accessibility."** Directly responds to comprehensive playtest reviews highlighting beginner cognitive overload, lack of kinetic reward on hits, and targeting friction. Bridges authentic 6-DOF physics with intuitive feedback:

### Added & Enhanced
- **Smart Target Auto-Acquisition (`TargetDesignation.ts`, `GameLoop.ts`)**:
  - Eliminates "flying blind" friction for new pilots.
  - In `AUTO` (autopilot) mode, continuously locks the top-priority threat so the autopilot can intercept.
  - In `ASSIST` mode, automatically locks onto the lead threat upon takeoff so the pilot immediately receives HUD brackets, closure rate, and range without needing to know the `[T]` key.
  - Respects manual cycle (`[T]`) and manual release (`[DEL]`).
- **Visceral Kinetic Combat Payoff (`CameraShake.ts`, `VectorDebris.ts`, `HUD.ts`)**:
  - Kill confirmed camera trauma increased by 3.8× (trauma-squared amplitude jumped from 0.01 to 0.144) for canopy-rattling feedback on splashes.
  - Vector debris fragmentation increased from 16 to 28 fragments with 50 m/s explosive dispersal velocity.
  - Kill callouts highlighted with high-visibility gold illumination (`THEME.caution`) and glowing halo.
- **Anti-Stall Cruise Protection (`FlightAssist.ts`)**:
  - In `ASSIST` mode, if airspeed drops below 130 m/s while cruising (and pilot is not intentionally holding throttle down), the flight computer maintains positive throttle floor so beginners don't stall out from neglecting throttle keys.
- **HUD Readability & Decluttering (`HUD.ts`)**:
  - In `ARCADE` mode, replaced raw engineering fuel volume (`4321 L`) with clean percentage (`FUEL 86%`).
  - Prioritized emergency warnings (stall, terrain, SAM launch) over training steps, while keeping active training steps prioritized over routine informational hints.
- **Enhanced Post-Mortem Diagnostics (`PostMortem.ts`)**:
  - Added specific loss causes and actionable recovery tips for aerodynamic stalls, fuel exhaustion, ocean ditching, and terrain impact.
- **Beginner Sortie Recommendation (`GameLoop.ts`)**:
  - First-time players with no flight records default to `TRAINING_SORTIE` on browser start, preventing rookies from getting thrown into 5-wave combat strikes unexpectedly.

---

## [1.7.0] — 2026-09-21

**"Radar Readability & Experience Audit."**
- Increased tactical radar HUD size across all breakpoints (125–185 px, radius 58–86 px) for clear grid and contact interpretation.
- Published 25-Pillar game review and entertainment audit (`docs/reviews/review-v1.7.0.md`).

---

**"Turn and Burn."** A second human playtest of the live build said: *I cannot turn left or right, the
jet can only go north; the radar is not clear; I died and do not know why; there is too much on the
screen and I do not know what to do.* All four were true. Finding out *why* the jet would not turn
turned up something worse than the review had guessed: the aircraft's orientation basis was not
orthonormal, so lift pushed the jet the **wrong way** in a bank and the cockpit view was sheared.

### Fixed

- **Banking now turns the jet, in the right direction.** `AircraftPhysics.upVector` and the renderer's
  `basisVectors` used the roll-left sign for `up` and for two `right` components but the roll-right sign
  for `right.y`. `right · up` was `-sin(2·roll)`, so at 46° of right bank the lift vector pointed
  up-and-*left*. Both are now derived from one rotation and asserted orthonormal at arbitrary
  attitudes. The cockpit horizon is asserted to tilt the right way in both banks.
- **Pull-while-banked steers the nose.** The stick is now a body pitch rate mapped to the stored Euler
  angles (`dPitch = q·cos φ`, `dYaw = q·sin φ / cos θ`). Before, back-stick only ever raised the nose
  toward the sky whatever the bank.
- **Loops, Immelmanns and Split-S work.** The ±88° pitch clamp is gone: past vertical the same
  attitude is re-expressed (pitch folds back, heading and roll turn half a circle), so the nose flows
  through the top with no NaN and no discontinuity.
- **The training prompt no longer says to roll for the sake of it** ("THE JET TURNS WHERE YOU BANK"),
  and the missile hint no longer contradicts the missile banner (both say chaff `[X]`).

### Added

- **Turn assist (on by default in the game loop, off in the raw physics).** A held bank pulls the nose
  round by itself; an alpha limiter eases the pull before the stall angle so the assist can never be
  what stalls the jet; an upright bank stops at 75° so a held key is a turn, not an accidental barrel
  roll. Measured: about 9°/s from a held bank alone (90° in ~10 s); a sustained 180° is ~19 s because the
  heavy jet bleeds speed in a hard turn (see Known Issues #56).
- **Tactical radar.** The corner scope is now heading-up and shows the carrier (white square, with
  `CV 8.4NM` under it), every live bandit as a red triangle pointing the way it flies, hardened
  objectives as yellow diamonds, the designated target ringed, north on the rim, and SAM launches as a
  red arc on the rim toward the site. Geometry lives in `RadarMath.ts` and is tested.
- **A death you can read.** Losing the airframe now holds the cockpit for 2.6 s at 0.3× speed with the
  controls dead, `MAYDAY - AIRFRAME LOST` and the cause (`KILLED BY MiG-23`) on the glass, then goes to
  the deck. It works for cannon, SAM and terrain from the one place they all call.
- **Fair guns.** A fighter must hold a guns solution for 0.7 s before its first burst, and you get a
  `GUNS TRACKING` callout the moment it has one. Bursts hit 60% of the time; a miss is audible.
- **Attack coaching.** The coach ticker now says `BANDIT AHEAD - PRESS [T] TO LOCK ON`, then
  `LOCKED - TURN TOWARD THE BANDIT`, then `IN RANGE - FIRE [SPACE]`, and `BANDIT ON YOUR TAIL - BANK
  HARD AND PULL` above all of them when something is lining you up. It read from the tracker's own
  solutions, so "ahead" and "in range" mean what the HUD brackets mean.
- **First-time milestones** (`Milestones.ts`, remembered across sessions): `FIRST BLOOD!`, `FIRST TRAP -
  WELCOME ABOARD`, `CHAFF SAVED YOU`, `OVER THE TOP` (first loop). One louder line, once.

### Changed

- The scope is larger (104-156 px, was 92-132) so the carrier distance and contacts are legible.
- `EnemyAI.updateEnemyAI` gained optional `onAim` and injectable `rng`; `onFire` now receives `hit`.
- `FlightAssist` comments no longer claim the airframe cannot turn without rudder.

### Corrected from the review

The review that started this release was right about the symptoms and wrong about several causes; see
[`docs/reviews/v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md`](docs/reviews/v1.6.0/IMPLEMENTATION_AND_CORRECTIONS.md).
In short: the hint ticker already existed, the Arcade HUD was already the default, the training
sortie already existed, two more maps already existed, and its proposed `g·tan(φ)/V` fix would have
turned at ~4°/s, flipped sign when inverted, and doubled up with the autopilot's rudder.

### Not done

- The fjord layout is unchanged (deliberate: mission balance is built on it). See Known Issues #53.

---

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
