# Recommendations & Roadmap — v1.5.0-dev

> **Ordering principle:** sorted by *player value per line of code*, not by
> technical interest. Every item states **why**, because a recommendation
> without a reason cannot be argued with — and some of these should be argued
> with.

---

## Tier 0 — Ship This Week (cost: ~50 lines, impact: enormous)

These are near-free and they fix broken promises rather than adding features.

### T0-1. Route first-time players to the actual tutorial
**File:** `src/core/Scenarios.ts:691-699`
**Cost:** 1–3 lines + 1 test

```ts
// Before: finds CARRIER_DEFENSE, because that is what carries the checklist flag
const checkout = SCENARIOS.find(s => s.setup.showTrainingChecklist);

// After: an explicit, unambiguous flag
const checkout = SCENARIOS.find(s => s.setup.isFirstFlight);
```

**Why:** `TRAINING_SORTIE` was purpose-built with `noSamSites: true`,
`combatShielded: true` and zero hostiles, and *no player can currently reach it
by default*. Building a safe tutorial and then routing past it into endless
combat is the highest-cost, lowest-benefit state possible: the work is paid for
and the benefit is zero. This is the best line of code you will write this year.

**Add a regression test:** `expect(recommendScenario(emptyRecords()).id).toBe('TRAINING_SORTIE')`.

### T0-2. Fix the `[A]` → `[F]` tutorial key bug
**File:** `src/core/Scenarios.ts:599, 600, 633, 634`
**Cost:** 4 string edits

**Why:** the tutorial currently tells a new pilot to press a key that rolls them
into the sea. Obeying the game's instruction is punished. Nothing else on this
list matters if a beginner's first taught action crashes the aircraft.

### T0-3. Make the autopilot tutorial step actually check the autopilot
**File:** `src/core/Scenarios.ts:635`
**Cost:** add one field to `MissionSnapshot`

```ts
// Before — passes on a timer; congratulates players who did nothing
isComplete: (s) => s.airSpeed > 90 && s.missionSeconds > 20,
// After
isComplete: (s) => s.flightAssistMode === 'AUTOPILOT',
```

**Why:** a tutorial step that validates nothing teaches nothing, and
`"AUTOPILOT VERIFIED"` is a lie the game tells the player. Lying tutorials
destroy trust in every subsequent instruction.

### T0-4. Prevent this class of bug permanently
**File:** new test in `src/core/Scenarios.test.ts`
**Cost:** ~15 lines

Assert that **every key string mentioned in any scenario card or phase exists in
`CONTROL_SCHEMA` for that context.**

**Why:** `Controls.ts` was built as the single source of truth precisely to stop
documentation drift — but its guarantee stops at the README and never reached
mission prose. Extend the boundary to cover every place a key is named. This is
the architectural lesson of the `[A]` bug, and it is worth more than the fix.

### T0-5. Commit the uncommitted work
**Cost:** one commit

**Why:** `PointerInteractivity.ts`, pitch inversion and HUD density are among
the most valuable player-facing features in the project and they exist in
exactly one working directory, one `git checkout` from deletion.

---

## Tier 1 — The Defensive Verb (cost: ~250 lines, impact: transformative)

**This tier is the difference between watching and playing.**

### T1-1. Give the SAM missile a turn-rate limit and lead pursuit
**File:** `src/tactics/RadarLOS.ts:327-395`
**Cost:** ~30 lines + tests

Replace the instantaneous re-point with a clamped rotation toward a lead-pursuit
aim point:

```
desiredDir = normalize(leadIntercept(aircraft, missilePos, missileSpeed))
maxTurn    = MISSILE_MAX_TURN_RATE * dt        // e.g. 25 deg/s
currentDir = rotateToward(currentDir, desiredDir, maxTurn)
```

**Why:** this is the single highest-leverage 30 lines in the codebase. Today the
missile has an infinite turn rate, so *every* defensive manoeuvre is equally
useless and the player correctly concludes there is no defence. With a turn
limit, beaming and last-ditch breaks suddenly *work*, and the game gains an
entire skill dimension for almost no code. **It also makes the existing terrain
mechanic better**, because now terrain is one option among several rather than
the only one.

*Tune so a good break turn at speed defeats a shot at maximum range but not one
fired inside 2,000 m — that gradient is where the skill lives.*

### T1-2. Add chaff / flares on `[X]`
**Cost:** ~80 lines + HUD counter

Finite count (12). Break probability modulated by aspect angle: high when the
missile is beaming, low hot-aspect. Add a visual burst and a distinct sound.

**Why:** players need a **button to press when afraid**. The psychology matters
more than the mechanics: the difference between "I survived because I reacted"
and "I survived because terrain happened to be there" is the difference between
mastery and luck. Finite count also creates a resource-management meta-layer
that connects to the deck loop you already built.

### T1-3. Make the incoming missile visible and quantified
**Files:** `src/core/GameLoop.ts:2310`, `src/renderer/HUD.ts:1364`
**Cost:** ~60 lines

1. Render the missile as a **growing tracer with a fading smoke trail**, not an
   8 m line segment that is sub-pixel at launch range.
2. Add `TIME TO IMPACT: 6.2` to the warning banner.
3. Add a directional **threat caret** on the HUD edge pointing at the missile.

**Why:** you cannot dodge what you cannot see. The game currently tells the
player they are in danger without showing them the danger, which produces
anxiety without agency — the exact recipe for quitting.

### T1-4. Post-mortem on death (Dimension 20)
**Cost:** ~50 lines

On destruction, show a short causal card:

```
  KILLED BY   SA-6 "GRUMBLE" at 4,180 m
  CAUSE       Held 900 m AGL inside the launch envelope for 9.2 s
  NEXT TIME   Descend below 300 m AGL to mask, or shoot the site first
```

**Why:** unexplained death is the #1 rage-quit driver in combat games. A death
the player *understands* is motivating; a death they do not understand is unfair.
This is cheap because every number is already in the simulation.

---

## Tier 2 — The Missing Arsenal (cost: ~300 lines, impact: high)

### T2-1. AGM-88 HARM anti-radiation missile on `[4]`
**Cost:** ~120 lines in `Weapons.ts` + HUD lock cue

Locks **only** SAMs in `SEARCH`/`TRACK`/`LAUNCH` state. If the target goes
`SILENT` mid-flight, the missile goes ballistic and misses.

**Why:** this is the best feature this game could add, because the depth is
*already built* — `RadarLOS.ts` has the four-state radar machine and the LOS
system. It creates a genuine duel out of existing parts: bait the SAM into
radiating, then kill it with its own emission. It also makes `IRON_HAND` a
coherent mission for the first time, and it directly answers a real player's
real question.

### T2-2. Let Sidewinders be replaced by a proper ASM, or make the gun viable
**Why:** currently the only precise anti-SAM tool requires **40 cannon hits
within an 8-metre radius** while inside the site's lethal envelope. That is not
difficulty, it is an impossibility budget. Either give ground targets a
realistic strafe profile (~10 hits, 15 m radius) or accept that the gun is not
an anti-SAM weapon and stop implying it is.

### T2-3. "Call the boat" cruise-missile strike on `[Z]`
**Cost:** ~100 lines

Designate with `[T]`, request with `[Z]`, 45–60 s flight time, 1–2 per sortie.

**Why:** the player asked for this unprompted, which is the strongest possible
signal of a feature-shaped hole. The **delay is the design** — it turns the call
into a plan rather than a delete button, and it finally gives the carrier a
relationship with the player while they are 40 km downrange. It also fits the
1988 Cold War battle-group fantasy better than any solo-ace mechanic could.

---

## Tier 3 — Comprehension & Attraction (cost: ~200 lines, impact: high retention)

### T3-1. A first-run settings card before the first flight
Ask **three** questions, once, in plain language — never jargon:

```
   1. STICK RESPONSE   [ PULL BACK TO CLIMB ]  ( PUSH UP TO CLIMB )
   2. HUD              [ SIMPLE ]              ( FULL INSTRUMENTS )
   3. PACE             [ ARCADE ]              ( SIMULATION )
```

**Why:** every one of these settings already exists (`[I]`, `[U]`, `[O]`) and
nobody finds any of them. **The features are built; only the door is missing.**
Never write "inverted" — half of players believe it means the opposite of what
you mean, so the word creates the confusion it is meant to resolve. The existing
`UP = DIVE` / `UP = CLIMB` phrasing is already correct.

### T3-2. Detect the control fight and offer the fix
If the pitch axis is reversed 3+ times within 400 ms in the first 60 seconds,
prompt: *"Fighting the stick? Press [I] to flip pitch."*

**Why:** this is the signature of wrong-axis muscle memory, and it is the most
common silent rage-quit in the genre. The game already has the input stream; it
just is not listening.

### T3-3. Progressive control disclosure
Do not present 40 bindings at once. Gate them by mission:
`TRAINING_SORTIE` = 6 keys. `CARRIER_DEFENSE` = 12. `IRON_HAND` = full set.

**Why:** the keybinding list is the game's most intimidating screen, and it is
shown before anyone has flown. Complexity is not the problem; **simultaneity**
is. Chunking is free and it is the standard solution.

### T3-4. Default the HUD to ARCADE for unblooded pilots
**Why:** 22 instruments is a *reward* for competence, not an *introduction* to
it. `HudLayout` already supports both; only the default is wrong.

### T3-5. A 15-second attract loop on the title screen
**Why:** for marketability (Pillar 11) the vector-CRT look is the hook, and
nobody sees it before committing. An autoplaying canyon run with the CRT bloom
sells the game in five seconds — which is the entire budget a social-media
viewer gives you.

---

## Tier 4 — Accessibility & Long-Term (Dimension 21)

* **T4-1. Key remapping.** `CONTROL_SCHEMA` is a `readonly` const with no override
  layer. **Why:** `WASD`+`QE` is meaningfully worse on AZERTY and QWERTZ keyboards,
  and there is no recourse for left-handed or limited-mobility players. A
  `Map<string, string>` override persisted to `localStorage` is ~40 lines.
* **T4-2. Reduced-motion mode** that damps `CameraShake`. **Why:** vestibular
  sensitivity is common, and camera shake is currently unconditional.
* **T4-3. Quaternion orientation** to remove gimbal lock (`KNOWN_ISSUES §2`).
  **Why:** enables true vertical loops and Immelmanns — the manoeuvres that make
  dogfighting expressive. Large ripple; schedule deliberately, not opportunistically.
* **T4-4. Enemy tracer projectiles** replacing hit-scan (`KNOWN_ISSUES §4`).
  **Why:** same principle as T1-1 — damage you cannot see coming cannot be played
  around, and tracers are also the best visual juice in the genre.

---

## Suggested Release Split

| Release | Contents | Theme |
| :--- | :--- | :--- |
| **v1.4.1 (hotfix)** | T0-1 … T0-5 | *"The tutorial works now"* |
| **v1.5.0** | T1-1 … T1-4, T3-1, T3-2 | *"You can fight back"* |
| **v1.6.0** | T2-1 … T2-3, T3-3 … T3-5 | *"Iron Hand, properly"* |
| **v2.0.0** | T4-1 … T4-4, campaign depth | *"Accessibility & expression"* |

**Ship v1.4.1 before anything else.** It is under an hour of work and it
un-breaks the front door.

---

## A Note on Sequencing

Resist the temptation to start with T2-1 (the HARM). It is the most *interesting*
item here and therefore the most dangerous — it is a new weapon system, which is
fun to build, while T0-1 is a one-line change to a function you have already
written, which is not.

But T0-1 affects **100% of new players** and T2-1 affects only those who reach
mission three. **Build the boring fix first.** The evidence that this ordering is
hard to follow is already in the repo: v1.4.0 shipped a padlock camera, time
rewind, and a voice system while the tutorial pointed at the wrong key.
