# Workflow, Story and UX: a review of where the fun is

A pass over the whole game asking one question — *where does a player's
attention actually go, and is that where the interesting decision is?* — with
what was changed as a result, and what was deliberately left alone.

This is a design review, not a bug list. Everything here is judgement, and the
judgements are argued so they can be disagreed with.

---

## 1. The shape of a session

A run is: **boot → briefing → deck → catapult → sortie → trap → deck → …**,
ending in a debrief. The two loops are genuinely coupled (ordnance comes out of
carrier stocks, bombers that get through damage the deck, lost airframes are
gone), which is the game's best structural idea and is worth protecting.

### What was wrong

**The first decision a new player makes is the wrong kind of decision.** The
briefing offers five missions as five equally plausible doors — same size,
same weight, no marks of any kind — so it reads as a menu rather than a
campaign. A player picks by name, "CANYON STRIKE" sounds the most exciting, and
it is a five-pip mission with a four-minute clock and a hardened target that
shrugs off a near miss. The reasonable conclusion is that the game is
impossible.

**Nothing came back with you.** A single global best score was the only thing
carried between sessions. Across five scenarios of wildly different length that
number is close to meaningless: a long carrier defence out-scores a perfect
canyon strike by an order of magnitude, so four of the five missions had no
scoreboard at all and no record that you had ever beaten them.

### What changed

- Per-scenario records (`core/MissionRecords.ts`): best, completions, attempts.
- The selector ticks a cleared mission; the masthead counts them; the headline
  carries that mission's own best.
- `recommendScenario()` marks exactly one pill `START HERE` (or `FLY THIS NEXT`
  if you have attempted it), and the debrief names what to fly next.
- A brand-new player is pointed at the mission that runs the flight checkout,
  not the one with the fewest difficulty pips — the latter is carrier
  qualification, which has no tutorial and consists entirely of the hardest
  skill in the game.

### What was deliberately not changed

**Nothing is locked.** The recommendation is a suggestion. A player who wants
the canyon strike as their first ever sortie should be allowed to have it —
gating would buy a tidier difficulty curve at the cost of the thing that makes
a mission list feel like a sandbox rather than a corridor.

---

## 2. The flying was in the way of the game

The 6-DOF model — real stall, induced drag, a 40 m arresting-gear envelope — is
the reason this project is interesting. It is also, for a new player, a wall.
Scripted testing of the canyon strike made it obvious: the jet was on its back
in a fjord before the mission had begun. A player in that position never sees
the game that is *behind* the flying — the masking, the weapon choice, the
timing of a strike window.

The answer is not to make the aeroplane easier. It is to let the player choose
how much of it to fly:

| Level | The fantasy |
| --- | --- |
| `MANUAL` | *I am a pilot.* |
| `ASSIST` | *I am a pilot who is not going to die of inattention.* |
| `AUTOPILOT` | *I am a weapons officer.* The jet flies; I fight. |

`AUTOPILOT` is the one that changes what the game **is**, and it is the answer
to the question that prompted this review. With the aeroplane flying itself the
player's whole attention goes to the tactical picture: which contact, which
weapon, when to shoot, when to break. That is a different and genuinely fun
game living inside the same simulation, and it costs one key.

Two hard-won details:

- **The protections stand down on a carrier approach.** An approach *is* a
  deliberate descent to a deck 20 m above the water. A ground-proximity floor
  that applied on final would make a trap impossible at the default assist
  level — a far worse bug than the crash it prevents.
- **The autopilot does not land.** Turning onto final hands the aeroplane back.
  The trap is the best thing in the game; nobody wants it done for them. The
  recovery assist added later does not change that: it flies the ball and the
  speed and hands back at short final, which removes the part a phone cannot do
  and keeps the part that is the game.

---

## 3. "Which of those five boxes did I pick?"

Before this pass, every airborne contact drew an identical bracket and the
Sidewinder chose its own target from a 30° cone. There was no way to express
*that one* — so in a furball the player had no tactical agency at all, only
positional agency.

Designation (`T`) separates the two decisions a fight is made of: **what** to
kill, and **how**. The chosen target gets a solid box, a range, and the weapon
its current geometry actually supports; the seeker, the HUD and the autopilot
all follow it. The steering chevron means a target off the glass is still a
decision rather than a lost object.

This is also what makes `AUTOPILOT` more than a novelty: with the flying handled
and a scope you can step through, the loop becomes *designate → close →
choose → shoot → break*, which is a complete game.

**Later addition:** the scope only offers what the pilot can see. It had ranked
everything within 20 km through solid rock, which meant the single most
interesting decision in the game — how low to fly — was a decision with only a
downside. Now the ridge that hides you from the launchers hides the launchers
from you, and climbing to build a picture costs you your own masking. One filter
turned an existing simulation feature into a choice.

---

## 4. Variety: three maps instead of one

Every mission, forever, was the same fjord with the same three launchers in the
same three places. Variety had to come entirely from objectives, and learning
the map once removed most of the tension from all of them.

The three maps are deliberately three different bargains, not three skins:

- **BJORNFJORD** — total cover, no choices. The route *is* the mission.
- **NORWEGIAN SEA** — no cover at all. Against a radar lock the answer has to
  be speed, aspect and the bay doors.
- **KVITOYA RIDGES** — cover is available but brief, and only in the right gap.
  The low route weaves instead of running straight.

Each map carries unit-tested guarantees (navigable corridor, clear approach
tube, masking possible) because a map that quietly cannot mask breaks a core
mechanic with no error message.

---

## 4b. The first minute, the weight, and something to share

The three findings that prompted the pacing/feel/daily pass, each measured on
the build that preceded it:

| Finding | Measurement |
| --- | --- |
| Nothing happened for the first minute | ~35 s of transit to a contact 8.3 km out, under a HUD announcing the first package at 150 s |
| Dying cost half a minute of progress bars | `HANGAR_MAINTENANCE` 18 s → `ARMING_REFUELING` 14 s, on every loss *and* every successful trap |
| Nothing had any weight | No camera shake anywhere; one 20 mm round inside 18 m destroyed any aircraft; the arrested landing was an instant view switch and a log line |
| Nothing left the tab | One global best score, no artifact, no reason to return tomorrow |
| The mix was not a mix | Every voice wired straight to the output: clipping under load, no priority, no stereo, so audio carried no tactical information |

What changed, and the reasoning that is worth keeping:

- **ARCADE is the default, SIM is one key away.** The deliberate timings make
  the better simulation and the worse first impression. Measured briefing to
  first kill: 9.6 s against no kill in two minutes. Neither audience loses.
- **The cost of dying is the airframe and the score, not the waiting.**
  Punishing a mistake twice - once in the currency of the game and once in the
  player's time - is how a game teaches people to stop playing.
- **Rounds wound.** A one-hit-kill cannon with an 18 m radius was both trivial
  and weightless: there was no such thing as *hitting* something, only killing
  it, so there was no feedback to give. Four hits to a fighter creates the
  state that hit markers, ticks and a health-bar read of the fight all live in.
- **The trap gets its moment.** 1.6 s of held camera, a stamped wire grade and
  the loudest sound in the game. It is the hardest thing here; it should be the
  most satisfying, and it was the most throwaway.
- **The daily is unlimited-attempt.** Wordle's one-shot rule works because
  everybody already knows how to play. Locking the day here punishes exactly
  the person who has just discovered the game. The card states the attempt, so
  honesty costs nothing.
- **Audio became information.** A SAM firing off the left wing now pans left
  and sounds far away; being shot at no longer plays your own gun sound. The
  mix has priority - alerts above beds - so the sound that means *do something*
  is the sound you hear.

## 5. Still open — ranked by what they would buy

1. **The deck loop is mostly waiting.** The macro layer's interesting decision
   (fuel versus ordnance) is made once, in about four seconds, and the rest is
   watching a progress bar. It wants a second axis — a choice with a cost, such
   as a rushed turnaround that risks a crew-fatigue penalty, or holding a jet
   back as alert-five cover. This is the largest remaining gap between the
   game's structure and its fun.
2. **The strike missions have no second act.** Every scenario resolves in one
   pass. A mission that changes its mind halfway — a pop-up threat, a target
   that turns out to be defended, a recall — would make the mission director
   earn its structure.
3. **The story is scenery, not stakes.** The briefing prose is good and the
   world is coherent, but nothing carries between missions: the campaign has no
   memory beyond a score. Carrying *losses* forward — airframes, stores, hull
   damage — across a run of missions would make each sortie cost something.
4. **The autopilot cannot fly a route.** It follows terrain now, and it holds a
   bearing well, but a large heading change departs the aeroplane (KNOWN_ISSUES
   §19). That is what stops the recovery assist being a "take me home" button,
   and it is the one piece of unfinished engineering the rest of this list keeps
   running into.
5. **Nothing offers the colour-blind palette to the player who needs it.** It
   exists and it works; it is behind a key in the control reference. An
   accessibility prompt on first run would cost very little.

A combo multiplier, medals and local leaderboards were all considered and
deliberately left out; the daily sortie was judged the one retention hook worth
building first.

**Closed since this list was written:** designation ignoring line of sight (see
the later addition at the end of §3); the autopilot climbing over terrain
rather than threading it; landing on a phone being brutal; carrier defence
being locked to one map; difficulty being fixed per scenario; and red and green
being load-bearing. Five of the eight, and the three that remain are the three
that are really design work rather than engineering.

---

## 5b. Reach: the phone

Half of casual web traffic is a handset, and the game was keyboard-only. That
is not a missing feature; it is a closed door, and nothing behind it counts for
anyone holding a phone.

The thing that made it tractable is that the door had already been unlocked by
accident. `AUTOPILOT` flies the aeroplane and designation picks the target, so
the mobile fantasy was already built and only needed a way to reach it: the
player becomes a weapons officer rather than a pilot short of eight fingers.

Two judgements worth keeping:

- **Tap the thing you want.** Cycling a list with a button is a keyboard idiom
  wearing a thumb's clothing. Pointing is the gesture a touchscreen is for, and
  it turned out to be better on a desktop too, so mouse players got it as well.
- **Shed, do not shrink.** At 568x320 the instruments and the controls were
  drawn on top of each other. The answer was not smaller instruments but fewer:
  the keyboard legends, the checklist, the compass tape, the RWR scope and the
  briefing's tutorial cards all stand down, and each one's information is
  carried by something that stayed. That is the same rule the deck screen and
  the cockpit already followed - it just had to be told that a thumb is a
  layout constraint.

---

## 5c. What the second pass actually cost

Worth recording, because the shape of it was not obvious going in: **four of
the six items in that pass were cheap, and the fifth ate more time than the
other five together.** The recovery assist was scoped as "fly the glideslope",
looked like an afternoon, and turned into an investigation of the flight model
that found three real defects — a stall limiter that only knew one sign, an
autopilot that led with full rudder, and a stall that did not always annunciate
— before ending up deliberately smaller than it started.

The lesson is not "avoid the hard ones". It is that a feature which asks the
simulation to do something it has never been asked to do is a research task
wearing a feature's clothes, and it should be scheduled as one.

---

## 6. Principles these passes followed

- **Never make the simulation lie.** Every assist is a control law producing the
  same stick and throttle demands a pilot would, integrated by the same physics.
  Nothing teleports, and nothing can put the aircraft somewhere it could not
  have flown.
- **Guidance, not gates.** The game now has opinions about what you should fly
  next and what you should shoot at. It never enforces them.
- **An annunciator that is always lit is not an annunciator.** Auto-levelling
  happens on every frame the stick is centred and is deliberately silent, so
  that when the glass does say `TERRAIN — AUTO PULL-UP`, it means it. The same
  rule governs the mix: the alert bus is loudest precisely because almost
  nothing is on it.
- **Presentation must never touch the simulation.** Shake moves the camera;
  callouts and flashes read state and never write it. The moment feel can
  influence physics, the determinism the whole test suite rests on is gone.
- **Measure the claim.** "It feels faster" is an opinion; "briefing to first
  kill, 9.6 s against no kill in two minutes" is a result. The same applies to
  the mix, which is verified by instrumenting Web Audio in a real browser
  rather than by listening once and deciding it sounds fine.
