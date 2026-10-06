# v2.3.0 — "Bring a Friend": the share review

The brief, verbatim: *"User should have good experience, they will love to
share this to friends."*

Reviewer: the agent that built v2.0-v2.2, with a research agent, a code
review agent and a UX review agent it dispatched. **No human playtest** - see
`SELF_CRITIQUE.md`.

---

## 1. The audit: both ends of a share, as they were (v2.2.0)

Walked in a browser at 1440 × 900, 1280 × 720 at EXTRA LARGE, and an
844 × 390 phone.

**The sender's end - the debrief.** The share was a text box near the bottom,
in 10-12 px type:

```
CARRIER VECTOR: 1988 — SCRAMBLE ★☆☆
5 WAVES HELD · 2,200 PTS · 1 splashed
beat it: bejranonda.github.io/carrier-vector-1988/?c=270033887.2200.5
[C] copy result
```

| Problem | Why it matters |
| :-- | :-- |
| The action was a key hint, "C copy result", inside the box | Nothing looked like a button; on desktop it copied silently to the clipboard |
| Pilot slang: "splashed", "waves held", "beat it:" | Written for the person who flew, read by a friend who never has |
| No picture | People post pictures; a block of text in a chat is easy to scroll past |
| No name | "A challenge" is a link from nobody; "Anna challenges you" is a person |
| No `https://` | Some chat apps do not turn a bare `host/path` into a link, and never build a preview card for it |
| Beating a friend's score was a grey line under a red "CARRIER LOST · WAVE 2" | The single best reason to share back was the least visible thing on the screen |

**The receiver's end - opening the link.** The full mission select: the
title, a daily banner, seven mission tabs, three explanation cards, eleven
key hints, and the challenge as one line of small yellow text under the
title. A first-time visitor - very likely on a phone, very likely not a gamer -
had to find the point of the link themselves.

---

## 2. Research: what happens to a share after the tap

A research agent was asked what chat apps keep, how link previews work, where
the Web Share API works, and what makes people - especially people over 50 -
share. Its findings, with the sources it cited:

| Finding | Consequence for the design |
| :-- | :-- |
| A share with a file, text and a url reaches each app as separate items; **WhatsApp on iPhone keeps the text and drops the picture**; **Facebook and Messenger on Android keep the picture and drop the text** (Apple developer forum threads 733508, 745690; Raymond Camden 2023) | The challenge (text + link) and the picture are **two separate shares** |
| iPhone Messages and Messenger have been reported to strip the query string from a share's `url` field (Apple forum 724641) | The link goes **inside `text`**, alone on the last line - never in `url` |
| Android Chrome joins `text` and `url`; iOS keeps `title` only when there is no text or url | No `title`, no `url` |
| Web Share with files: iOS/iPadOS Safari 14+, Android Chrome 76+, Samsung Internet, desktop Chrome on Windows/ChromeOS/macOS 128+, Edge 93+, Safari 14+. **None** in the Android in-app browsers of Facebook, Messenger and Instagram, in Firefox desktop, or Chrome on Linux (MDN compat data, caniuse) | Where there is no share sheet: WhatsApp (`wa.me`), LINE, a text message (phone) or email (desktop), copy and download |
| A tap's permission to open a share sheet lasts ~5 s, is spent by `share()`, and on touch is granted by the finger lifting, not landing (HTML spec, Chromium and WebKit sources) | The picture is encoded **before** a button can be pressed; the sheet opens from a DOM `click`, never from the canvas `pointerdown` |
| The share promise resolves when an app is chosen, not when anything is sent (MDN) | Nothing says "sent" |
| `og:url` is treated by Facebook as the real destination; this page's pointed at the home page | Challenge links open `/c/`, the same page with no `og:url` or `canonical` |
| Query strings reach server logs and preview fetchers; fragments never leave the browser (OWASP, MDN) | The name rides after `#` |
| Wordle grew from 90 players to over two million in about ten weeks after adding its share grid; personalised invitations raised clicks by 50% (Branch/Dubsmash); 88% trust recommendations from people they know (Nielsen) | A short, personal challenge in a friend's own words |
| People sending to one person share what is useful to them; people posting avoid what does not flatter them (Barasch & Berger 2014) | A modest run is shared as an **invitation** ("EASY mode flies the plane for you"), a strong one as a challenge |
| 90% of over-50s own a smartphone; 84% of over-50 gamers play on phones, most often with children or grandchildren; 63% are highly worried about scams (AARP 2023, 2026) | Plain words, a known sender's name, and the message says what the link is: "a free game in your browser, no download" |
| Nagging is a recognised dark pattern (deceptive.design) | No automatic sheet, no prompt after every run, no reward for sharing |

---

## 3. What was built

**The friend's end**

- **"ANNA CHALLENGES YOU"** - the first screen of a challenge link: who sent
  it, the score to beat, the waves and fly style, one sentence on what the
  game is, one big ACCEPT CHALLENGE, and SEE ALL MISSIONS for everything else.
  The browser tab says "Anna challenges you".
- An EASY challenge flies EASY for a newcomer without asking - the same
  fight, one tap sooner. A STANDARD one still asks.
- **The score to beat is on the HUD** (`4,200 / 12,345 PTS`, even on the
  first-flight HUD), and passing it is a moment: "YOU BEAT ANNA!" and a
  fanfare, once. Without a challenge the run chases the pilot's own best:
  "NEW PERSONAL BEST!" as it happens.
- **A beaten challenge is the debrief's headline**, in gold - "YOU BEAT ANNA! /
  By 55 pts - the carrier went down at wave 2" - and the share button reads
  REPLY TO ANNA.

**The sender's end**

- **SHARE** beside FLY AGAIN (C on a keyboard), lit when the run is worth
  sending, with one line saying why ("NEW PERSONAL BEST - SHOW YOUR FRIENDS").
- **The share panel** (plain DOM): an optional name ("Your name on the card"),
  the picture, and the right buttons for the device - REPLY TO ANNA /
  CHALLENGE A FRIEND / INVITE A FRIEND and SEND THE PICTURE where there is a
  share sheet; WhatsApp, LINE and a text message or email where there is not;
  COPY MESSAGE, SAVE PICTURE, and COPY PICTURE on a computer.
- **The picture**: a 1080 square in the game's look and the pilot's palette -
  the run's best moment (a frame kept a beat after the best kill), the stars,
  the score, waves and kills, the pilot's name or both names after a
  challenge, and "CAN YOU BEAT ME?" or "I BEAT ANNA!".
- **The message**, in plain sentences with the link alone on the last line -
  e.g. *"I beat Anna! 12,400 points to 12,345 on EASY in Carrier Vector: 1988.
  Your turn - same waves, a few minutes:"*.

**Links**: `https://.../c/?c=seed.score.waves[.e]#n=Name`.

---

## 4. Rejected

- **One share with everything in it** - the first build. Rejected on the
  research above before release.
- **A personalised preview image per challenge** - needs a server (preview
  fetchers do not run JavaScript); the project has none by policy.
- **Rewards for sharing** (stars, unlocks) - a dark pattern, and it would make
  the share about the reward instead of the friend.
- **`openExternalBrowser=1` on every link** (opens LINE links outside LINE's
  in-app browser) - a longer, stranger link for every app to help one.

---

## 5. Scoring (implementer, provisional)

The v2.0.0 "hit" rubric, for a non-gamer:

| Dimension | v2.2.0 | v2.3.0 | Why |
| :-- | :-: | :-: | :-- |
| Hook | 8 | 8 | Unchanged for a player who finds the game; a friend's link now opens on its own screen |
| Core loop | 8 | 8 | Unchanged |
| Juice | 8 | 8 | "YOU BEAT ANNA!" / "NEW PERSONAL BEST!" with a fanfare - small, but at the right moment |
| Goals | 8 | **9** | A number to chase on the HUD in every SCRAMBLE run - a friend's, or your own best |
| Persistence | 7 | 7 | Unchanged |
| Again | 9 | 9 | Unchanged; REPLY sits next to FLY AGAIN |
| Shareability | 9 | **10** *(provisional)* | Picture, plain-words challenge, names, the friend's first screen, a reply loop - **unverified on real phones and apps** |
| Clarity | 8 | 8 | Unchanged |
| **Mean** | **8.1** | **8.4** | |

Shareability's 10 stands only until the first real-device test says otherwise
(`RECOMMENDATIONS_AND_ROADMAP.md` P1).
