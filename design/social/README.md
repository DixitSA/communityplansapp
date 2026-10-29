# yard. Instagram kit (@yard.irl)

Graphics are built from `kit.html` with the app's own palette and type (DESIGN.md §3).
Render them all to `design/social/out/` (from the repo root):

```powershell
node design/social/render.cjs
```

Needs Playwright (`npx playwright install chromium` once on Windows). The look matches best with the
free **Inter** font installed (rsms.me/inter); otherwise your system font is used.

| File | Size | Use |
|---|---|---|
| `avatar.png` | 1080×1080 | Profile picture |
| `hello.png` | 1080×1350 | Post 1: intro |
| `how.png` | 1080×1350 | Post 2: how it works |
| `private.png` | 1080×1350 | Post 3: privacy |
| `weekend.png` | 1080×1350 | Weekly "This weekend in Charlotte" post |
| `story.png` | 1080×1920 | Same, as a story |

**Weekly post:** edit the `picks` list in `kit.html` (Thursday is a good day), re-render, post. Always
check each event's date, time and venue on its own page before posting; the feed is scraped and can be wrong.

## Profile
- **Name:** yard. · Charlotte
- **Bio:**
  > Everything happening in Charlotte, and which friends are going.
  > Find your people. ✦
  > App coming soon ↓
- **Link:** a waitlist form (Google Form or Tally is fine for now).

## Launch grid
Post in this order. Instagram shows newest first, so the intro should go up **last** and sit top-left.
1. `private.png`
2. `how.png`
3. `hello.png`

### Captions
**hello.png**
> Charlotte has a lot going on. Most of it you hear about the day after. 🫠
> yard. puts everything happening in the city on one calendar, and shows you which friends are going.
> Coming soon. Follow along. ✦
> #charlotte #cltevents #charlottenc #thingstodoincharlotte #queencity

**how.png**
> Three ways to say yes:
> ♡ Interested: just for you, nobody else sees it.
> 👥 Down if friends go: we'll ping you when a friend commits.
> ✓ Going: friends and fellow attendees can see you're in.
> Which one are you, usually?

**private.png**
> Your maybes stay yours. "Interested" is private, always. Friends only see you once you're Going, and blocks override everything.
> Privacy isn't a setting on yard. It's the product.

**weekend.png** (weekly)
> This weekend in Charlotte 🎃 Halloween edition.
> Fri: 2000s Halloween Party @ The Underground
> Sat: Drag brunch @ NoDa Brewing · Charlotte FC vs. Orlando City
> Sun: Día de Muertos @ Camp North End · David Sedaris @ Ovens
> Save this, send it to the group chat. 👻
> #cltevents #charlotteevents #charlottenightlife #halloweenclt

## Routine (≈30 min a week)
- **Thursday:** weekend post + story.
- **Monday:** one story poll ("What did you get up to?") or a reshare of a venue's post (tag them).
- Tag the venues in the weekend post; they often reshare, which is the cheapest growth there is.
- Reply to every comment and DM in the first month.
