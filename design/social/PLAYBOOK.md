# yard. content playbook (@yard.irl)

Based on the October 2026 marketing brief. The rule: **show the outcome (people showing up and connecting), not the app.**
Rough split to start: ~50% Reels, ~35% carousels, ~15% static. Then follow the data, per series.

## Ground rules
- **Real only:** real people, original footage, verified events. No AI-generated people or scenes.
- **Photos:** yours, a venue's with permission (tag and credit), or licensed. Never scraped images.
- **Verify every event** on its own page (date, time, price) before it goes in a post. The app feed is a starting point, not a source.
- **Consent:** anyone identifiable on camera says yes on camera ("Cool if we post this on @yard.irl?"). Get a signed release for anyone featured heavily. Delete on request, no argument.
- **Optimize for sends and saves**, not likes. Every post should be something someone forwards to a group chat.

---

## Series 1: Yard on the Street (Reels, 15–40 s)
Closest to what works for @222place: real strangers, unscripted, one good question.

**Gear:** phone, a clip-on mic (~$20–40, the biggest quality upgrade), a mic flag or sticker with "yard." on it.
**Where:** Camp North End, South End rail trail, NoDa on a Friday, Freedom Park, Optimist Hall, farmers markets.
**When:** Sat 11 AM – 3 PM. People are relaxed and not rushing.

**Question bank (pick one per video):**
1. How did you actually make friends after college?
2. What's the most Charlotte way you've ever met someone?
3. Would you go to an event alone? Why or why not?
4. What's a plan you keep saying "we should" about and never do?
5. Where would you take someone new to Charlotte on a Saturday?
6. What's the best thing you've done in this city that nobody talks about?
7. Group chat: who's the friend who never confirms?

**Shot list:**
1. Hook on screen in the first second, e.g. **"I asked 10 Charlotte people how they made friends after college"**.
2. Fast cuts, 1–3 s per answer, keeping only the surprising, funny or honest ones.
3. One answer that lands emotionally, near the end.
4. Close on a sincere line, e.g. "Most said the same thing: keep showing up to the same thing."
5. End card for 1 s: small "yard." with "@yard.irl". No app pitch.

**Caption:** the hook, then a question for comments ("What's yours?"). Tag locations.

## Series 2: Your Weekend, Sorted (carousel, 5–7 slides, every Thursday)
This one's built: `carousels.html` → `ws-*.png`. The angle is **things you can show up to alone**; that's yard's difference from Charlotte guide accounts.
To update it weekly:
1. Pick 5 events, using the app feed and `agent-playbooks/event-scout.md`.
2. Verify each one.
3. Edit the `picks` list in `carousels.html`.
4. Run `node design/social/render.cjs carousels.html`.

Caption: "Save this for the weekend. Going to one? Comment which; someone else might be too." Tag every venue.

## Series 3: Unfinished Plans Club (carousels and short skits)
This one's built too: `up-*.png`, a relatable texting story that ends in a soft yard mention.

**Skit ideas (10–20 s, two people, one location):**
- **"We should hang soon"** speed-run: the same two friends saying "we need to hang" in five seasons (jacket changes), then finally at an event, still saying "we should do this more".
- **The group chat, live:** four friends standing in a row reading their "down" texts aloud deadpan. One says "down if everyone's down". The camera holds on silence.
- **The yes ladder:** "Interested" → "Down if friends go" → "...Going?" as escalating facial expressions. That's literally the app's three buttons, and nobody needs to know it yet.

## Series 4: We Went Alone (Reels, first-person)
Go to one event alone each week and film it honestly.
1. **Before:** outside, a little nervous: "I know nobody here. Let's see."
2. **The awkward first 5 minutes**, no edit-out.
3. **The turn:** the first conversation (with consent), the activity, the vibe.
4. **After:** "Would I go back? ..." Be honest, even when it's a no.

Pick events that are actually welcoming (recurring, structured). Tag the host.

## Partnerships (the growth loop)
Find a Charlotte community that welcomes new people (run club, creative meetup, book club, hobby group). Then:
1. Make one co-created Instagram Collab post with them.
2. List their events in yard (verified).
3. Send viewers to the waitlist.
4. Recap the event with consent.
5. Repeat with the next community.

**DM template:**
> Hey! I'm building yard., a Charlotte app that shows what's on and which friends are going, so people stop skipping things because they'd be going alone. We love what you do with [community]. Could we feature your next [event] in our weekend guide, or film a short Collab reel about what it's like to show up as a newbie? Totally your call on what goes out.

Prioritize local organizers, young-professional creators and people who already document Charlotte nights, not follower counts. Give each partner their own tracking link.

## First 30 days
| Week | Publish | Learn |
|---|---|---|
| 1 | Unfinished Plans carousel, Your Weekend Sorted, 1 relatable Reel; fix bio and waitlist link | Which hooks reach Charlotte people? |
| 2 | First Yard on the Street, Your Weekend Sorted, first partner Collab | Do human-led formats beat graphics? |
| 3 | We Went Alone + 1 skit, Your Weekend Sorted, 1 product demo using real app screenshots | What drives waitlist signups? |
| 4 | Double down on the top 2 series, a second Collab, one event recap | What repeatably converts? |

Stories most days: polls ("going out or staying in?"), a "where should we go?" question box, behind-the-scenes footage.
Use **Trial Reels** to test new formats on non-followers first.

## Weekly scorecard (one row per post)
`date · series · format · reach (Charlotte %) · avg watch time · shares · saves · profile visits · link clicks · waitlist signups`
Judge each series on its own numbers for 3–4 posts before cutting or scaling it. Followers are a vanity metric here; waitlist signups (later: people tapping Going) are the real one.

## Older assets
- `kit.html` posts (`hello`, `how`, `private`): identity pieces. Keep 1–2 on the grid, not the strategy.
- `reel.html` (the auto "This weekend" reel): a template look, so it's weaker per the brief. Use it as a Story, or test it as a Trial Reel, not as the main format.
