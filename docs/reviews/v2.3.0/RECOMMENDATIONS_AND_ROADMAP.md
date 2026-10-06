# v2.3.0 — Recommendations & Roadmap

✅ shipped · 🔨 ready to build · 🤔 owner decision.

## Tier 0 — real devices, real apps, real people

### P1 🔨 The share loop on real phones (an afternoon)
Send a challenge from an iPhone, an Android phone and a desktop into
WhatsApp, LINE, Messages/SMS and Messenger; open each on another phone.
Record: does the link stay clickable and keep its `?c=` and `#n=`; is there a
preview card; does SEND THE PICTURE arrive as a picture; does the friend land
on "ANNA CHALLENGES YOU". Put the live `/c/` link through Facebook's Sharing
Debugger. Everything in `SHARE_REVIEW.md` §2 is research until this is done.

### P2 🔨 Pilot-customer round, with a friend at each end
Eight people as before (four over 50, two who do not play games) - but in
pairs: one plays and shares, the other receives it on their own phone.
Measure: does the sender find SHARE, do they type a name, which button do they
press, does the friend tap ACCEPT, does the friend reply.

## Tier 1 — shipped in v2.3.0 ✅

| Change | Where |
| :-- | :-- |
| "ANNA CHALLENGES YOU" first screen; EASY challenges skip the question | `renderer/ChallengeView.ts`, `GameLoop.acceptChallengeWelcome` |
| Score to beat on the HUD; "YOU BEAT ANNA!" / "NEW PERSONAL BEST!" mid-run | `GameLoop.checkScoreTarget`, `HUD.scoreWithTarget` |
| A beaten challenge is the debrief headline; REPLY TO ANNA | `GameLoop.debriefData`, `DebriefView` |
| SHARE beside FLY AGAIN; the share panel with name, picture, device-right buttons | `ui/SharePanel.ts`, `index.html #share` |
| The picture: best moment, stars, score, name, versus | `renderer/ShareImage.ts`, `GameLoop.captureMoment` |
| Challenge and picture as separate shares; link in text; WhatsApp/LINE/SMS/email fallbacks | `core/Share.ts`, `core/ShareCard.ts` |
| `https://`, `/c/` page without `og:url`, the name after `#` | `core/Challenge.ts`, `vite.config.ts` |

## Tier 2 — next, in order

### N1 🔨 "Add to home screen" for phone players (~60 LOC + icons)
Still the most-asked-for phone feature on the roadmap: a manifest and icons,
offered once on the phone debrief - after a share, when the player has just
shown they care.

### N2 🔨 A challenge preview image (no server)
A second static `og:image` for `/c/` that reads as an invitation ("A FRIEND
CHALLENGED YOU - CAN YOU BEAT THEIR SCORE?") rather than the game's poster.

### N3 🤔 A daily "beat the world" link
The daily's seed is the same for everyone; a daily share could open the daily
itself (counting as the friend's daily) rather than a challenge on its waves.

### N4 🔨 Phone menus at large text (#103) and the type-scale pass (#104)
Carried over from v2.2.0.

## What not to do next

- No rewards for sharing, no share prompt after every run, no automatic share
  sheet. The line above SHARE lights for a win, a best or a new star; that is
  the whole nudge.
- No leaderboards that need a server, and no accounts. The challenge link is
  the social graph: it is the player's own, in their own chat.
