# Comprehensive Game Review — v1.5.0-dev (Working Tree)

## Review Metadata

| Field | Value |
| :--- | :--- |
| **Evaluated Version** | `v1.5.0-dev` — working tree at `082d667` + 11 modified / 3 untracked files |
| **Evaluation Date** | 2026-09-20 |
| **Reviewer** | Game Review Agent (entertainment + code + design triangulation) |
| **Base Tag** | `v1.4.0` (`082d667`) |
| **Unreleased work in tree** | `PointerInteractivity.ts` (new), pitch-inversion toggle `[I]`, HUD density `[U]`, `CockpitVoiceSystem` edits |
| **Test Suite** | **809 passed / 809 (45 files), 16.4 s, exit 0** |
| **Production LOC** | 18,010 (non-test) + 9,493 (test) — a **0.53 test-to-source ratio** |
| **Runtime Dependencies** | **0** (verified in `package.json`) |
| **Review Method** | Source audit + mechanic tracing. Playtest evidence supplied by a human player. |

---

## 0. Executive Summary

**Carrier Vector: 1988 is an outstanding piece of software engineering wrapped
around a game that does not yet let the player play.**

The engineering is, frankly, better than most commercial indie games: 809
passing tests, zero runtime dependencies, a genuinely correct 6-DOF flight model
with dynamic pressure and induced drag, swept-segment proximity fuzing to
prevent missile tunnelling, and simulation logic cleanly decoupled from
rendering so every mechanic is headlessly testable. The code comments are the
best I have read in a hobby game repo — they explain *why*, they document past
bugs, and `Controls.ts` derives its own README table to prevent documentation
drift. That is professional discipline.

And yet a real player flew it and came back with three questions, all of which
turned out to be **missing features rather than misunderstandings**. That gap —
between technical excellence and player comprehension — *is* the review.

The defining problem is this: **the player has almost no verbs for responding to
threat.** When a missile is fired at them, they have one answer (find terrain)
and it is barely visible. When they are told to destroy a SAM, they have two
answers and both require flying into the thing that kills them. A game where
bad things happen *to* you, rather than *at* you, is a game you watch rather
than play.

The second defining problem is an onboarding pipeline that is **actively
inverted**. v1.4.0 built a beautiful safe tutorial mission — `TRAINING_SORTIE`,
with `noSamSites: true`, `combatShielded: true`, zero hostiles — and then never
routes anybody to it. The first-time-player recommender sends new pilots to
`CARRIER_DEFENSE`, the endless-waves combat mission (§3.1). Meanwhile the
tutorial that *does* exist tells the player to press `[A]` for autopilot, which
actually rolls the aircraft left (§3.2).

**Scores: Engineering 9.0 / 10. Player Entertainment 5.2 / 10. Composite 5.76 / 10.**

The distance between those two numbers is the entire opportunity. Almost
everything needed to close it is already built and merely unreachable.

---

## 1. Framework Extension: 15 Dimensions → 21

The existing `REVIEW_TEMPLATE.md` 15-pillar framework is strong, but this
playtest exposed blind spots it could not catch. Three of the player's issues
scored "fine" on all 15 existing pillars while being severe defects. **Six new
dimensions are proposed and applied below.**

| # | New Dimension | Why the existing 15 missed it |
| :---: | :--- | :--- |
| **16** | **Defensive Counterplay & Threat-Response Vocabulary** | Pillar 15 measures frustration *level* but not its *cause*. It cannot distinguish "hard but fair" from "no counterplay exists". |
| **17** | **Control Convention Conformance & Muscle-Memory Transfer** | Pillar 14 covers input *ergonomics* (can I click it?) but not input *semantics* (does it do what 30 years of genre training says?). |
| **18** | **Tactical Toolset Completeness (Means-Ends Coverage)** | No pillar asks "for every objective the game sets, does the player possess an appropriate tool?" This is how a SEAD mission shipped without SEAD weapons. |
| **19** | **Teachability & Diegetic Discoverability** | Pillar 7 covers onboarding *pacing*. It does not cover whether a mechanic is *learnable at all* without external docs. |
| **20** | **Failure Legibility & Death Post-Mortem** | Nothing measures whether the player understands *why* they died. Unexplained death is the #1 driver of rage-quit in combat games. |
| **21** | **Accessibility, Remappability & Inclusive Design** | The colour-blind palette is tracked nowhere in the rubric, and key remapping — entirely absent — is invisible to all 15 pillars. |

> **Recommendation:** promote these into `REVIEW_TEMPLATE.md` as the standing
> 21-dimension framework. Dimension 18 in particular should be a **release gate**:
> *no mission ships until the tool that mission implies exists.*

---

## 2. Scoring Rubric (21 Pillars)

| # | Pillar | v1.4.0 | v1.5.0-dev | Δ | Rationale |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 1 | Flight Dynamics & Aerodynamics | 8.5 | **8.5** | — | `q = ½ρv²`, induced drag, symmetric stall, Mach drag rise, fixed 1/120 s semi-implicit Euler. Capped by Euler-angle gimbal lock (±88° clamp, `KNOWN_ISSUES §2`). Genuinely excellent. |
| 2 | Loop Cadence & Dopamine Architecture | 6.0 | **6.0** | — | Micro-loop (guns) is crisp. Meso-loop is broken by no-counterplay SAMs. Macro-loop (launch→strike→trap) is the game's best asset. |
| 3 | Spatial Awareness & Camera | 6.5 | **7.0** | +0.5 | `PadlockCamera` is a real upgrade. Still no missile-threat caret; 60° FOV remains tight in a scissors. |
| 4 | Soundscape & Cockpit Voice | 7.0 | **7.5** | +0.5 | `CockpitVoiceSystem` ships `MISSILE / PULL_UP / STALL / BINGO`. Procedural synthesis is strong. Brevity-code chatter still thin. |
| 5 | Visual Game Feel & Kinetic Juice | 7.0 | **7.0** | — | `ExplosionParticle` line debris + `CameraShake` deliver. Near-miss shockwave still absent. |
| 6 | Narrative Atmosphere & Dynamic Sorties | 6.5 | **6.5** | — | Ghost-Lead radio persona is a great device, underused. 1988 Norwegian Sea framing is well-chosen. No reactive mid-mission drama. |
| 7 | Onboarding, Pacing & Churn Prevention | 3.5 | **3.0** | **−0.5** | **Regression.** A safe tutorial now exists but the recommender routes new players past it into combat (§3.1). Worse than having no tutorial, because the effort is invisible. |
| 8 | Strategic Agency & Deck Operations | 7.0 | **7.0** | — | Fuel/ordnance triage, rush-turnaround stamina cost, EMCON via bay doors (RCS ×4.0). Genuinely good systems design. |
| 9 | Campaign Stakes & Meta Retention | 5.5 | **5.5** | — | `CampaignState`, `MissionRecords`, `HighScore`, `DailySortie` exist. No persistent attrition or branching campaign map. |
| 10 | Performance, Frame Pacing & Thermals | 8.5 | **8.5** | — | Fixed timestep decoupled from render; display-ladder tests present. Canvas2D `shadowBlur` in RETRO remains the mobile thermal risk. |
| 11 | Marketability & Social Streamability | 6.0 | **6.0** | — | Vector-CRT aesthetic is a strong, ownable hook. Zero-dependency story is great developer-audience marketing. No clip export. |
| 12 | Architectural Health & AI Safe-Extensibility | 9.5 | **9.5** | — | **Best-in-class.** 809 tests, 0 deps, pure logic modules, `Controls.ts` as single source of truth for docs. An AI agent can safely refactor here. |
| 13 | Cognitive Load & Visual Hierarchy | 5.0 | **5.5** | +0.5 | `[U]` ARCADE/PRO density toggle is the right idea. Undermined by defaulting to dense and hiding the toggle among 40 bindings. |
| 14 | Desktop Input Ergonomics | 5.0 | **6.0** | +1.0 | New `PointerInteractivity.ts` begins fixing the mouse-dead-HUD problem. Uncommitted and partial. |
| 15 | Entertainment-to-Frustration Ratio | 4.5 | **4.5** | — | Time-to-first-fun is gated behind a lethal environment with no defensive verbs. |
| **16** | **Defensive Counterplay** | — | **2.0** | *new* | **Worst score in the review.** Zero countermeasures; infinite-turn-rate pursuit missile (§3.3). Terrain masking is the only answer. |
| **17** | **Control Convention Conformance** | — | **5.0** | *new* | `[I]` toggle exists with excellent labelling, but defaults against genre standard and is undiscoverable (§3.4). |
| **18** | **Tactical Toolset Completeness** | — | **4.0** | *new* | `IRON_HAND` SEAD mission ships with no anti-radiation weapon. Sidewinders cannot hit ground targets at all. |
| **19** | **Teachability & Diegetic Discoverability** | — | **3.5** | *new* | 40+ flat keybinds; tutorial contains a wrong key (§3.2); core mechanics explained only in banner text. |
| **20** | **Failure Legibility & Post-Mortem** | — | **4.0** | *new* | Player dies without a causal explanation or a "what to do differently" screen. |
| **21** | **Accessibility & Remappability** | — | **5.0** | *new* | Colour-blind palette `[C]`, touch layout, and ARCADE pacing are real wins. **No key remapping at all** — `CONTROL_SCHEMA` is a `readonly` const. |
| | **ENGINEERING INDEX** | 8.85 | **9.00** | +0.15 | Pillars 1, 10, 12 — outstanding. |
| | **PLAYER ENTERTAINMENT INDEX** | 6.32 | **5.20** | **−1.12** | Pillars 7, 15–20 — the game is less approachable than its own systems deserve. |
| | **COMPOSITE (21-pillar mean)** | — | **5.76** | — | |

---

## 3. Critical Defects (Verified in Source)

### 3.1 [P0 / BLOCKER] The tutorial mission is orphaned — new players are routed into combat

`src/core/Scenarios.ts:691-699`:

```ts
const neverFlown = SCENARIOS.every(s => recordFor(records, s.id).attempts === 0);
const checkout = SCENARIOS.find(s => s.setup.showTrainingChecklist);
if (neverFlown && checkout) return checkout;
```

The recommender looks for `showTrainingChecklist`. But:

| Scenario | `showTrainingChecklist` | Hostiles | SAMs |
| :--- | :---: | :---: | :---: |
| `CARRIER_DEFENSE` | **`true`** (line 277) | endless waves | **yes** |
| `TRAINING_SORTIE` | **`false`** (line 586) | none | `noSamSites: true` |

So **every first-time player is sent to `CARRIER_DEFENSE`** — the endless combat
mission — while `TRAINING_SORTIE`, purpose-built as a safe familiarisation flight
with `combatShielded: true` and zero hostiles, sits unreachable at index 5 of the
mission list.

This is the single highest-value fix in the entire document. It is a **one-line
change** (match on scenario id, or add a `isCheckout` flag) and it transforms the
first-run experience.

### 3.2 [P0 / BLOCKER] The tutorial teaches a key that does the wrong thing

`TRAINING_SORTIE` instructs the player to press `[A]` for autopilot in **four
places** (`Scenarios.ts:599, 600, 633, 634`):

> *"Engage Autopilot with [A] to maintain wings level."*
> *"Ghost-Lead: Tap [A] to engage Autopilot."*

But `Controls.ts:33` binds `[A]` to **roll left**, and the actual flight-assist
key is `[F]` (`Controls.ts:53`).

**A brand-new pilot who obeys the tutorial will roll their aircraft into the
fjord.** In the one mission designed to build confidence, the game gives a wrong
instruction and then punishes obedience. This is the most damaging four-character
bug in the repository.

Worse, the phase's completion predicate does not even check the autopilot state:

```ts
isComplete: (s) => s.airSpeed > 90 && s.missionSeconds > 20,
```

It passes on a timer, so the tutorial will congratulate a player
(`"AUTOPILOT VERIFIED"`) who never engaged the autopilot. **The step teaches
nothing and validates nothing.**

> **Ironic note:** `Controls.ts` opens with a comment explaining that it exists
> precisely to stop key documentation drifting from code. That discipline was
> applied to the README and then not extended to mission prose. Fix: make
> scenario cards reference `CONTROL_SCHEMA` entries rather than hardcoded strings,
> and add a test asserting every key mentioned in a card exists in the schema for
> that context.

### 3.3 [P0] No defensive counterplay exists against SAMs

Fully analysed in [`PLAYER_QUESTIONS_ANSWERED.md`](PLAYER_QUESTIONS_ANSWERED.md) §Q1.
Summary: zero countermeasures in `src/`; the SAM missile re-points directly at the
aircraft every tick with no turn-rate limit, making manoeuvre defence
mathematically impossible. Only terrain masking or 10-second burnout saves the
player.

### 3.4 [P1] Pitch defaults against genre convention; the fix is buried

Fully analysed in [`PLAYER_QUESTIONS_ANSWERED.md`](PLAYER_QUESTIONS_ANSWERED.md) §Q3.

### 3.5 [P1] A SEAD mission without SEAD weapons

Fully analysed in [`PLAYER_QUESTIONS_ANSWERED.md`](PLAYER_QUESTIONS_ANSWERED.md) §Q2.

### 3.6 [P1] High-value usability work is uncommitted

`git status` shows `PointerInteractivity.ts` untracked and pitch inversion,
HUD density, and voice-system changes unstaged. These are among the best
player-facing improvements in the project and they exist only in one working
directory.

### 3.7 [P2] Key remapping is absent

`CONTROL_SCHEMA` is `readonly` and consumed directly. A left-handed player, a
player on an AZERTY/QWERTZ keyboard, or a player with limited hand mobility has
no recourse. Note `[Q]`/`[E]`/`[W]`/`[A]`/`[S]`/`[D]` are all physically
different positions on AZERTY — the game is meaningfully harder in France.

---

## 4. What Is Genuinely Good

Credit where it is substantially earned:

* **The test suite is exemplary.** 809 tests, 45 files, a 0.53 test-to-source
  ratio, all headless. Most shipped indie games have none. This is what makes
  the game safely AI-extensible, and it is the reason every recommendation in
  this review is *cheap* to implement.
* **Zero runtime dependencies, honestly.** Not "zero except a math library" —
  actually zero. 6-DOF dynamics, radar line-of-sight, procedural audio, and a
  wireframe renderer all written from first principles.
* **The code comments are the best I have seen in a hobby repo.** They record
  *why* a constant is what it is, and what bug motivated it. The swept-segment
  fuze comment in `RadarLOS.ts:356-362` explains tunnelling with the exact
  arithmetic — that is teaching, not commenting.
* **`Controls.ts` as a single source of truth** for keybindings, help overlay,
  briefing and README is a pattern more projects should steal.
* **The deck-operations layer is a real second game.** Fuel/ordnance triage,
  crew stamina as the cost of rushing, and bay doors as an EMCON tradeoff
  (`RCS ×4.0`) are elegant, readable systems design.
* **Gun tuning shows genuine craft.** The comment at `Weapons.ts:78-84` reasons
  from 12 m hit radius and 25 damage to "four hits kills a fighter, which is a
  fifth of a second on target". That is a designer thinking in *feel*, not
  numbers.
* **`KNOWN_ISSUES.md` marks deliberate trade-offs `[By design]`.** Honest
  engineering documentation. Rare and admirable.
* **The vector-CRT aesthetic is ownable.** In a market of photoreal sims, this
  looks like nothing else and costs nothing to render.

---

## 5. What Is Bad

* **The player is a passenger during the most dramatic moments.** Missile
  inbound is the peak-tension event in any flight game; here it resolves as a
  dice roll on terrain proximity.
* **Effort is invested in systems nobody reaches.** The tutorial, the pitch
  toggle, the ARCADE HUD, the padlock camera — all built, all behind a
  discovery wall. **The project's biggest problem is not missing features; it is
  unreachable ones.**
* **Complexity is front-loaded.** 40+ bindings, 22 instruments, six modes
  (`F`/`G`/`L`/`O`/`P`/`U`), three threat levels. All available immediately,
  none introduced gradually.
* **Missions ask for things the arsenal cannot deliver** (dimension 18).
* **Death teaches nothing.** No post-mortem, no "you were killed by SAM-3 at
  4,200 m because you stayed above the ridge line for 9 seconds".
* **Documentation volume exceeds product polish.** A 39 KB README and four
  review suites sit atop a game whose tutorial names the wrong key. **Writing
  about the game has outpaced playing it.**

---

## 6. Improvements vs. Regressions Since v1.4.0

### Improved
* `PointerInteractivity.ts` begins addressing the dead-mouse-HUD critique from the v1.4.0 review.
* Pitch inversion `[I]` directly addresses a real control-convention complaint, with excellent mode labelling.
* HUD density `[U]` (ARCADE/PRO) addresses the 22-dial cognitive overload critique.
* `CockpitVoiceSystem` delivers the "Bitchin' Betty" blueprint from the v1.3.0 roadmap.
* Test count grew to 809 with zero failures.

### Regressed or Still Broken
* **Onboarding regressed** — a safe tutorial exists but is unreachable, and it contains a wrong key. Effort spent, benefit zero, and now there is a broken artefact where there was previously just an absence.
* **Defensive counterplay unaddressed** across three consecutive reviews.
* **The arsenal gap unaddressed** — `IRON_HAND` has shipped without a SEAD weapon since it was introduced.
* **Every new feature ships behind a single-letter key with no surfacing.** The pattern repeats: build the fix, hide the fix.

---

## 7. The One-Sentence Diagnosis

> **This project builds excellent solutions and then hides them behind
> single-letter keybindings, while its most-needed features — a defensive verb
> and a standoff weapon — remain unbuilt.**

Fix the routing, fix the four-character `[A]`/`[F]` bug, add flares and a HARM,
and the Player Entertainment Index moves from 5.2 to an estimated **7.5+** with
perhaps 600 lines of code. The engineering foundation to do it is already the
best part of this project.

---

## 8. Related Documents

* [`RECOMMENDATIONS_AND_ROADMAP.md`](RECOMMENDATIONS_AND_ROADMAP.md) — prioritised fixes with rationale and estimates
* [`PLAYER_QUESTIONS_ANSWERED.md`](PLAYER_QUESTIONS_ANSWERED.md) — the three playtest questions, traced to source
* [`FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md`](FRANK_SUGGESTIONS_AND_PROMPT_GUIDELINES.md) — blunt critique of process, and review-prompt improvements
