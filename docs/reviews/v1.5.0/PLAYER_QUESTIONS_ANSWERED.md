# Player Questions — Answered With Code Evidence

> **Context:** Three questions raised by a real player during the post-v1.4.0 playtest.
> Each is answered against the actual source, not against intent or documentation.
>
> **Headline finding:** *All three questions are correct diagnoses of real design defects.*
> The player was not confused. The game is genuinely missing these things.

---

## Q1. "I don't know how to make defence when a missile comes to me."

### Answer: **Because there is no defence. Only terrain.**

**Evidence:**

```
$ grep -rn "chaff|flare|countermeasure" --include="*.ts" src/
(no results)
```

There are **zero countermeasures in the codebase.** No chaff, no flares, no ECM,
no jammer, no towed decoy. The word does not appear in `src/` at all.

**How the SAM missile actually behaves** (`src/tactics/RadarLOS.ts:327-395`):

```ts
const missileSpeed = 480; // m/s (~Mach 1.5)
sam.missileVel = {
    x: (mdx / mDist) * missileSpeed,
    y: (mdy / mDist) * missileSpeed,
    z: (mdz / mDist) * missileSpeed
};
```

This is **pure pursuit with an infinite turn rate.** Every tick the missile
velocity is re-pointed *directly* at the aircraft's current position. There is:

* no proportional navigation / lead pursuit,
* no turn-rate limit,
* no G limit,
* no energy bleed in the turn,
* no seeker field-of-view cone,
* no minimum engagement range.

**Consequence: the missile is mathematically undodgeable by manoeuvring.** A
break turn, a barrel roll, a split-S, a notch — every classic defensive move a
player might reach for from prior genre experience does *nothing*, because the
missile simply rotates to follow at zero cost. It flies at 480 m/s against an
aircraft doing ~250 m/s, so it always closes.

**The only two escapes that exist:**

| Escape | Mechanism | Code |
| :--- | :--- | :--- |
| Break line-of-sight | `if (fuel <= 0 || !hasLOS) sam.missileActive = false;` | `RadarLOS.ts:330-333` |
| Survive burnout | `sam.missileFuel = 10.0;` counted down by `dt` | `RadarLOS.ts:316, 328` |

So the correct answer to "how do I defend?" is: **put a mountain between you and
the launcher within 10 seconds, or take the hit.** That is it. That is the
entire defensive vocabulary of the game.

### Why the player still didn't work that out

The game *does* tell them. `src/renderer/HUD.ts:1364` and `src/core/Tutorial.ts:52`:

> `MISSILE INBOUND! DIVE BELOW MOUNTAIN RIDGE TO MASK`

But the instruction fails in practice for four reasons:

1. **The missile is nearly invisible.** It is drawn as a single 8-metre line
   segment (`GameLoop.ts:2310-2316`). At a 5,000 m launch range an 8 m line is
   sub-pixel. The player is told something is coming but cannot see it, cannot
   judge its bearing, and cannot judge time-to-impact.
2. **There is no time-to-impact readout.** Nothing tells the player they have
   roughly 8 seconds. Urgency is unquantified, so they do not know whether to
   panic or to finish their attack run.
3. **"Dive below the ridge" is not actionable without knowing which ridge.**
   There is no cue pointing at the nearest masking terrain.
4. **It contradicts a lifetime of genre training.** Every other combat flight
   game teaches "missile inbound → flares + break turn". This game silently
   punishes that reflex with a guaranteed hit.

### Recommendation

**P0-A — Give the missile a flight model that can be beaten by skill.**
Add a turn-rate limit (e.g. a 12 G equivalent, roughly 25 deg/s at 480 m/s) and
lead pursuit. Instantly this creates real counterplay: beam the missile, force
it to pull lead, make it bleed energy. This is a ~30-line change in
`RadarLOS.ts` and it converts the single most frustrating moment in the game
into its most skilful one.

**P0-B — Add chaff/flares on `[X]` with a finite count (e.g. 12).**
Give it a probabilistic break chance modulated by aspect: high when the missile
is beaming, low when it is hot-aspect. This gives the player a *verb* to press.
Pressing a button and surviving is dopamine; being told to "dive" and dying is
churn.

**P0-C — Make the threat legible.** Draw the missile as a growing tracer with a
smoke trail, add a `TIME TO IMPACT: 6.2` countdown, and put a directional
"THREAT" caret on the HUD pointing at it. A player must be able to *see* the
thing that is about to kill them.

---

## Q2. "I don't know how to destroy the SAM. Can we use air-to-surface missiles, or call base to launch a cruise missile on lock-on?"

### Answer: **Your instinct is exactly right, and those weapons do not exist.**

**The complete anti-SAM arsenal** (`src/flight/Weapons.ts`):

| Weapon | Requirement to kill a SAM | Code |
| :--- | :--- | :--- |
| 20 mm Vulcan | **40 hits within an 8 m radius** | `Weapons.ts:337-348` |
| Mk.82 iron bomb | one bomb within a 180 m splash | `Weapons.ts:437-446` |
| AIM-9 Sidewinder | **cannot target SAMs at all** — air-to-air only | `Weapons.ts` (SAMs absent from missile resolution) |

That is the whole list. There is no AGM-65 Maverick, no AGM-88 HARM, no
anti-radiation seeker, no standoff glide weapon, no laser designation, no
carrier-launched Tomahawk, and no naval fire support call.

**Why this is a genuine design hole, not a player skill gap:**

The game ships a dedicated SEAD mission — `IRON_HAND` (`Scenarios.ts:404-421`),
named after real USAF SEAD doctrine — whose briefing reads:

> *"Load Mk.82s — bombs are what kill a launcher."*

So the game asks the player to perform Suppression of Enemy Air Defences, the
one mission type that in reality is *defined* by the anti-radiation missile, and
hands them **dumb gravity bombs and a cannon.** To kill a launcher the player
must fly *into* the 5,000 m launch envelope of a missile they cannot dodge
(see Q1), and overfly the site at low altitude to deliver an unguided bomb.

The strafe option is worse: 40 cannon hits inside an **8-metre** radius against a
ground target, while inside that same lethal envelope. At 20 rounds/sec with
dispersion, that is multiple passes through a SAM's no-escape zone.

**This is the core difficulty spike of the entire game, and it is caused by
missing equipment rather than by intended challenge.**

### Recommendation

**P0-D — Add the AGM-88 HARM (anti-radiation missile) on weapon slot `[4]`.**
This single addition fixes the entire SEAD loop and creates a genuinely great
mechanic, because the game *already has* everything needed to make it deep:

* The SAM already has a radar state machine — `SILENT / SEARCH / TRACK / LAUNCH`
  (`RadarLOS.ts:307-325`).
* A HARM should **only lock a radiating SAM** (`SEARCH` and above).
* If the SAM goes `SILENT` (masked, or shut down) mid-flight, the HARM goes
  ballistic and misses.

That produces a superb tactical duel out of systems already built: *bait the SAM
into radiating, shoot the HARM, and the SAM's own aggression kills it.* It is the
most valuable single feature this game could add. Estimated cost: ~120 lines in
`Weapons.ts` plus a HUD lock cue.

**P1-E — Add the "call the boat" cruise-missile strike the player asked for.**
This is a strong idea and it fits the carrier fantasy perfectly. Implement it as
a **limited strategic resource** (1–2 per sortie): designate a SAM with `[T]`,
press `[Z]` to request, then a 45–60 second flight time before impact. The delay
*is* the game design — it makes the call a *plan* rather than a delete button,
and it reinforces that the player is part of a battle group rather than a lone
superhero. It also gives the carrier a reason to exist while the player is 40 km
away, which is currently a dead relationship for most of a sortie.

**P1-F — Add a `SILENT`-state visual for SAMs.** Let the player see which sites
are radiating. SAMs that shut down when a HARM is inbound create the cat-and-mouse
that makes SEAD the most beloved mission type in the genre.

---

## Q3. "From other jet fighter games, arrow-up should go down. Is that the aircraft control logic or not?"

### Answer: **You are right about the convention. The game currently defaults to the opposite.**

**The real-aircraft logic you are describing is correct:**

A control stick is a *physical lever*. Pulling it **back** (toward the pilot)
raises the nose; pushing it **forward** lowers the nose. When a keyboard emulates
that stick, the arrow keys represent *stick position*, so:

* `ArrowUp` = push stick **forward** = **nose down**
* `ArrowDown` = pull stick **back** = **nose up**

This is the default in Microsoft Flight Simulator, X-Plane, DCS, IL-2, and Ace
Combat. Your muscle memory is not wrong — it is the genre standard.

**What this game does** (`src/core/Controls.ts:31-32`):

```ts
{ keys: ['w', 'arrowup'],   label: 'Pitch nose UP',   ... },
{ keys: ['s', 'arrowdown'], label: 'Pitch nose DOWN', ... },
```

This is **"direct" / camera-style** control — up means climb. It is the arcade
convention, not the simulator convention. For a product that describes itself as
a *flight simulator* in its own package description, defaulting to the arcade
convention is a mismatch between promise and feel.

**There IS a toggle — but it is nearly undiscoverable.**

`Controls.ts:98` binds `[I]` to *"Toggle pitch inversion (Aviation stick vs. Direct)"*,
and `GameLoop.ts:1449-1456` handles it with genuinely excellent labelling:

```ts
this.pitchInverted ? 'STICK: REAL (UP = DIVE)' : 'STICK: DIRECT (UP = CLIMB)'
```

Those are the clearest mode names I have seen for this setting anywhere. The
problem is purely one of placement:

1. **The default is `false`** (`loadPitchInversion()` returns `false`) — so every
   new player starts in the *non-genre-standard* mode.
2. `[I]` is **one of 40+ key bindings** in a flat list. Nobody finds it.
3. It is **never offered at the moment of confusion.** The game knows when the
   player is fighting the pitch axis; it never asks.
4. **It is currently uncommitted work** (`git status` shows `M src/core/Controls.ts`).
   If this working tree is ever reset, the feature disappears entirely.

### Recommendation

**P0-G — Ask the question on the briefing screen, before the first flight.**
A two-option card, once, in plain language rather than jargon:

```
   STICK RESPONSE — how should UP behave?

   [1]  PULL BACK TO CLIMB      (real aircraft / flight-sim standard)   <- recommended
   [2]  PUSH UP TO CLIMB        (arcade / camera style)

   You can change this any time with [I].
```

Do **not** name these "inverted / non-inverted". Half of all players hold the
opposite idea of which one "inverted" means — the word causes the very confusion
it is meant to resolve. The existing `UP = DIVE` / `UP = CLIMB` phrasing is
already right; it just needs to appear earlier.

**P0-H — Detect the fight and offer the fix.** If, in the first 60 seconds of a
player's first sortie, the pitch axis is reversed within 400 ms more than three
times (a classic signature of wrong-axis muscle memory), show a non-modal prompt:
*"Fighting the stick? Press [I] to flip pitch."* This converts the single most
common silent-rage-quit cause into a one-second fix.

**P0-I — Commit this work.** Pitch inversion and `PointerInteractivity` are
modified/untracked and unreleased. They are two of the highest-value usability
features in the tree and they are currently one `git checkout` from oblivion.

---

## Summary: the player was right three times out of three

| Question | Player's instinct | Verdict |
| :--- | :--- | :--- |
| How do I defend against missiles? | "There should be a defence" | **Correct — there is none. Only terrain masking.** |
| Can I use ASM / cruise missiles on SAMs? | "There should be a standoff weapon" | **Correct — the SEAD mission ships without SEAD weapons.** |
| Shouldn't arrow-up pitch down? | "That's the flight-sim convention" | **Correct — the game defaults against it; the toggle is buried.** |

When a player's three spontaneous questions all turn out to be unimplemented
features, that is not a player education problem. **That is the game's backlog
speaking through the player.**
