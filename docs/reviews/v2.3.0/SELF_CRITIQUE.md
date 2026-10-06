# v2.3.0 — Self-Critique

## 1. What the earlier releases got wrong about sharing

| What v2.0-v2.2 believed | What v2.3.0 found | Lesson |
| :-- | :-- | :-- |
| "The share card is the growth loop" (v2.0.0) | It was a 10-12 px text box behind a key hint, in pilot slang, without a picture or a name - and the friend who opened its link landed on the full mission menu | A loop has two ends; walk both |
| "A link is a link" | `bejranonda.github.io/...` without `https://` is plain text, with no preview card, in some chat apps | Test the artefact where it lands, not where it is made |
| "Beating the challenge is on the debrief" | It was a grey line under a red CARRIER LOST | The emotion of a moment is decided by its size and colour, not by whether the words exist |
| "A run is its result" | A run had no number to chase while it was happening; "new best" was news after the fact | Put the goal where the player is looking, while it can still be reached |

## 2. What I got wrong this time, on the way

- **The first design put the picture, the message and the link in one
  share** - the obvious design, and the wrong one. The research brief came
  back after it was built: iPhone WhatsApp keeps the text and drops the
  picture; Facebook and Messenger on Android keep the picture and drop the
  link. Reworked into two shares before release. The research should have
  been commissioned before the first line, not alongside it.
- **The share panel closed itself on a phone.** It opened on the tap's
  `pointerdown`; the phone then delivered the same tap's `click` to the
  panel's CLOSE button, under the finger. Desktop and every unit test were
  fine; only a touch emulation run caught it.
- **"5 WAVEs · 0 PLANEs DOWN"** - a plural helper written for lower case. A
  smoke test caught it before a screenshot did.
- **Cut-off text in three places**, each seen only in a screenshot: the
  welcome screen's explanation line, the picture's subtitle (the pilot's name
  had been put there), and "REPLY TO…" on a narrow debrief button.
- **The mid-run "YOU BEAT ANNA!" could be followed by "25 pts short"** - a
  penalty after passing the score took it back under. The HUD now tracks the
  line both ways, and the banner says "AHEAD OF ANNA!": the run is not over,
  so it is not a win yet.

## 3. What the UX review found

A reviewer walked both ends again as a non-gamer and as an older player, on a
phone held upright as well as on a laptop. What it found was not bugs but
the things that make a person close a link:

| Finding | What it would have cost | Fix |
| :-- | :-- | :-- |
| "GRANDMA MARGARET CHALLENGES YOU" cut to "GRANDMA MARGAR..." on an upright phone | The one line that says who sent it, on the way most links are opened | Every line wraps (balanced), long names set smaller |
| The preview said "You have been challenged" | It has the shape of a scam text ("you have been selected") | "Can you beat my score? Carrier Vector: 1988 - a free jet game", and what it costs: nothing |
| Two equal send buttons - the challenge and the picture | The picture invites the first press, and a picture sent alone gives the friend nothing to open | One main button; the picture is offered after it |
| "Your name on the card" | "Card" means nothing to someone who does not play games | "Your name (optional) - so your friend knows it's you" |
| A lit SHARE after every new best | Sharing that feels asked for every time is nagging | Lit for a win or a star; a best lights it once a session |
| The picture led with a score and hid the names | A picture forwarded to a family group says nothing about who | The names are the headline ("TOM BEAT ANNA!"), the score a scoreboard |

## 4. What the code review found

Twelve findings, none high, each reproduced in a browser before it was fixed
and checked in one after (`SharePanel`, `main.ts`, `HUD`, `Challenge.ts`,
`ChallengeView`, `GameLoop`, `vite.config.ts`):

1. A **second share in a session showed - and saved - the first run's
   picture** until the new one was encoded. Cleared on open; the picture
   buttons wait for this run's picture.
2. **ESC did nothing** once focus had left the panel - which a mouse click on
   SHARE always did, by focusing the canvas under it. Stray keys now reach
   the panel; focus is taken back.
3. A long **Chinese, Japanese or Korean name** was measured as Latin and cut.
4. The **HUD's score to beat ran under the FIRE button** on a 568 px phone,
   and over the objective on a 720 px window. It now shortens to fit.
5. A **name typed just before a press** was left off the link.
6. **Look-alike dots** ("paypalꓸcom") and **invisible letters** got through
   the name cleaning; other spaces were deleted rather than kept.
7. **ENTER confirming a Japanese conversion** was taken as "done".
8. A **kill just before opening the menu** was photographed from whatever
   frame followed the menu.
9. **Every first run was shared as "my best yet"**, with "0 planes shot down".
10. The **/c/ build step could fail silently** - it now fails the build.
11. The canvas's **screen-reader label** kept "tap Accept Challenge" all
    session.
12. After a **failed share, a phone had no way to the picture**.

And one the review had already seen fixed in the working tree: a double tap
on the main button said "That did not work here" while the sheet was open.

**Lesson:** the code review found what no screenshot could - state carried
from one share to the next, focus after a mouse click rather than a key,
names from scripts the author does not type. The UX review found what no test
could - a sentence that reads like a scam. Each needed the other.

## 5. Still weak

1. **No real phone, no real chat app.** Every share was exercised up to the
   call that opens the share sheet; what WhatsApp, LINE, Messages or
   Messenger do next is the research's account, not a measurement. The first
   job of the next round is to send a challenge from three real phones into
   four real apps and open it on a fifth.
2. **The Facebook fix is unverified.** `/c/` drops `og:url` and `canonical`
   so a post keeps the `?c=`; it has not been put through Facebook's Sharing
   Debugger, which needs the page live.
3. **Every challenge link has the same preview card.** Preview fetchers do not
   run JavaScript and there is no server, so "Anna challenged you - 12,345"
   cannot be in the preview itself - only in the message above it.
4. **The best moment is often dark.** It is an honest frame of a wireframe sky
   - thin green lines on black. It is now drawn brighter, smaller and below
   the names; in a chat thumbnail the names and the score carry the picture.
5. **The welcome screen is canvas.** A screen reader hears the canvas's label,
   not "Anna challenges you" (the tab title and the label now say it, but the
   card itself is pixels).
6. **No human has played any of it** - seventh release running. The loop now
   has two people in it; the pilot-customer round should too.
