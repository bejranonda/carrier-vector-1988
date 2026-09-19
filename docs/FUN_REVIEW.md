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
  The trap is the best thing in the game; nobody wants it done for them.

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
3. **No map choice on the endless mode.** Carrier defence is the mission people
   will replay most and it is locked to one map. Letting it be flown on any of
   the three is cheap and triples its replay value.
4. **The story is scenery, not stakes.** The briefing prose is good and the
   world is coherent, but nothing carries between missions: the campaign has no
   memory beyond a score. Carrying *losses* forward — airframes, stores, hull
   damage — across a run of missions would make each sortie cost something.
5. **Difficulty is fixed per scenario.** There is no way to ask for a harder
   carrier defence or an easier canyon strike. With assist levels now in place,
   a threat-level selector on the briefing would compose neatly with them.

---

## 6. Principles this pass followed

- **Never make the simulation lie.** Every assist is a control law producing the
  same stick and throttle demands a pilot would, integrated by the same physics.
  Nothing teleports, and nothing can put the aircraft somewhere it could not
  have flown.
- **Guidance, not gates.** The game now has opinions about what you should fly
  next and what you should shoot at. It never enforces them.
- **An annunciator that is always lit is not an annunciator.** Auto-levelling
  happens on every frame the stick is centred and is deliberately silent, so
  that when the glass does say `TERRAIN — AUTO PULL-UP`, it means it.
