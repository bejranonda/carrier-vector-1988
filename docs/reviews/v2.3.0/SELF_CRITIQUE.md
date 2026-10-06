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
  line both ways; the banner still fires once.

## 3. Still weak

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
   - thin green lines on black - and in a chat thumbnail the score, not the
   frame, carries the picture.
5. **The welcome screen is canvas.** A screen reader hears the canvas's label,
   not "Anna challenges you" (the tab title and the label now say it, but the
   card itself is pixels).
6. **No human has played any of it** - seventh release running. The loop now
   has two people in it; the pilot-customer round should too.
