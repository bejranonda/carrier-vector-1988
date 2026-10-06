# v2.3.0 Review Suite — "Bring a Friend"

The owner asked: *"User should have good experience, they will love to share
this to friends."* This suite walks both ends of a share - the player sending
it and the friend opening it - with research on what happens to a share in
between, and documents the loop rebuilt around both, then reviewed twice
(a UX review as a non-gamer and an older player, and a code review) and
fixed.

## Read in this order

| # | Document | What it is |
| :-: | :-- | :-- |
| 1 | [**SHARE_REVIEW.md**](SHARE_REVIEW.md) | **Start here.** The audit of both ends as they were, the research (with sources), what was built and what was rejected. |
| 2 | [PLAYTEST_EVIDENCE.md](PLAYTEST_EVIDENCE.md) | The loop driven end to end in a browser, the phone tap, screens before and after, tests. |
| 3 | [SELF_CRITIQUE.md](SELF_CRITIQUE.md) | What the earlier releases got wrong about sharing, what went wrong on the way, what the UX and code reviews found, what is still weak. |
| 4 | [RECOMMENDATIONS_AND_ROADMAP.md](RECOMMENDATIONS_AND_ROADMAP.md) | Real phones and real apps first; then people, in pairs. |
| - | [../../HANDOFF.md](../../HANDOFF.md) | The project hand-over at this release: state, verification, open work, traps. |

## Headline

| | v2.2.0 | v2.3.0 |
| :-- | :-- | :-- |
| What a friend's link opens on | The mission menu, challenge in one small line | **"ANNA CHALLENGES YOU"**, the score to beat, what the game is, one PLAY - IT'S FREE |
| The score to beat during a run | Not shown | On the HUD, `ANNA 12,345 · YOU 4,200`; **"AHEAD OF ANNA!"** the moment it falls |
| Beating it on the debrief | Grey line under a red CARRIER LOST | **"YOU BEAT ANNA!"** in gold, the scoreboard under it, REPLY TO ANNA |
| The share | 10-12 px text box, "C copy result" | **SHARE** button → picture with the names + plain-words challenge + optional name |
| What is sent | One text card, link without `https://` | The challenge as text with its link on the last line ("I beat your score, Anna!"); then the picture, separately |
| No share sheet (in-app browsers, desktop) | Clipboard only | WhatsApp, LINE, text message / email, copy, save |
| Reviews | - | UX review (6 changes) and code review (12 findings, none high) - all fixed |
| Tests / browser checks | 1,185 / 66 | **1,228 / 81** |

## The one-line version

A share used to be a box of pilot slang that sent a friend to a mission menu;
now it is a picture and a challenge in plain words, and the friend's first
screen says who sent it and what to beat - with the result told to them in
flight, and a REPLY button at the end. Built, tested in a headless browser,
and researched - but not yet tried on a real phone in a real chat app.
