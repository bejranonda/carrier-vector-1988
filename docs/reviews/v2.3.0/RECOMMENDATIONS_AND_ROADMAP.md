# v2.3.0 — Recommendations & Roadmap

✅ shipped · 🔨 ready to build · 🤔 owner decision.

## Tier 0 — real devices, real apps, real people

### P1 🔨 The share loop on real phones (an afternoon)
Send a challenge from an iPhone, an Android phone and a desktop into
WhatsApp, LINE, Messages/SMS and Messenger; open each on another phone.
Record: does the link stay clickable and keep its `?c=` and `#n=`; is there a
preview card; does ALSO SEND THE PICTURE arrive as a picture (and does an
iPhone's long-press on it offer Save to Photos); does the friend land on
"ANNA CHALLENGES YOU". Put the live `/c/` link through Facebook's Sharing
Debugger. Everything in `SHARE_REVIEW.md` §2 is research until this is done.

### P2 🔨 Pilot-customer round, with a friend at each end
Eight people as before (four over 50, two who do not play games) - but in
pairs: one plays and shares, the other receives it on their own phone.
Measure: does the sender find SHARE, do they type a name, which button do they
press, does the friend tap PLAY, does the friend reply.

## Tier 1 — shipped in v2.3.0 ✅

| Change | Where |
| :-- | :-- |
| "ANNA CHALLENGES YOU" first screen, PLAY - IT'S FREE; EASY challenges skip the question | `renderer/ChallengeView.ts`, `GameLoop.acceptChallengeWelcome` |
| Score to beat on the HUD as a scoreboard; "AHEAD OF ANNA!" / "PAST YOUR BEST!" mid-run | `GameLoop.checkScoreTarget`, `HUD.scoreTargetOptions` |
| A beaten challenge is the debrief headline; REPLY TO ANNA | `GameLoop.debriefData`, `DebriefView` |
| SHARE beside FLY AGAIN; the share panel with name, picture, one main button | `ui/SharePanel.ts`, `index.html #share` |
| The picture: names in the headline, best moment, stars and score or a scoreboard | `renderer/ShareImage.ts`, `GameLoop.captureMoment` |
| Challenge, then the picture, as separate shares; link in text; WhatsApp/LINE/SMS/email fallbacks | `core/Share.ts`, `core/ShareCard.ts` |
| `https://`, `/c/` page without `og:url` (guarded by the build), the name after `#` | `core/Challenge.ts`, `vite.config.ts` |
| UX review (6) and code review (12) findings | `SELF_CRITIQUE.md` §3-4 |

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

### N5 🤔 A shorter, friendlier address
`bejranonda.github.io/carrier-vector-1988/c/?c=482913.12400.7#n=Anna` is
honest but long, and a GitHub address reads as "a developer's page" to some
of the people this release is for. A domain of the game's own (and a
`/c/482913-12400-7` path, which needs a 404-page redirect on GitHub Pages)
would read better in a chat and in the picture's footer. Costs money and a
yearly renewal - the owner's call.

## What not to do next

- No rewards for sharing, no share prompt after every run, no automatic share
  sheet. The line above SHARE lights for a win, a new star, or a beaten best
  once a session; that is the whole nudge.
- No leaderboards that need a server, and no accounts. The challenge link is
  the social graph: it is the player's own, in their own chat.
