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
| `reel.mp4` + `reel-cover.png` | 1080×1920, ~18 s | Weekly "This weekend in Charlotte" reel |

**Every week:** edit `picks.js` (the posts, story and reel all read it), then render:

```powershell
node design/social/render.cjs        # posts + story
node design/social/render-reel.cjs   # reel.mp4 + reel-cover.png (needs ffmpeg: winget install ffmpeg)
```

**Photos:** give a pick `image: 'img/name.jpg'` (save the file in `design/social/img/`, which isn't committed) or an image URL, plus `credit: '…'`. The reel shows it full-width at the top of that event's card with a slow zoom, and the post shows it as a thumbnail. Picks without a photo keep the colour design.
Only use photos you're allowed to repost: your own, a venue's or promoter's flyer with their OK (tag them and credit them), or free-licence stock. Ticketmaster's images are licensed for showing events in the app, not for social posts, so swap those for the venue's own flyer before posting publicly.

Each event can opt out of a format with `post: false`, `story: false` or `reel: false` (the post fits 5, the story 7, the reel about 6). Always
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

## Weekly reel
- **Post Thursday evening** (people plan their weekend Thu–Fri). Same format every week, so it becomes a series.
- **Audio:** the video is silent on purpose. In Instagram, add a trending sound (Reels → Audio); licensed audio plus trends gets reach, and music we embed could get muted.
- **Cover:** upload `reel-cover.png` as the cover so the grid stays tidy.
- **On-screen text** keeps clear of Instagram's buttons (right edge) and caption (bottom).
- **Caption template:**
  > This weekend in Charlotte 👇 [theme] edition
  > Fri: … · Sat: … · Sun: …
  > Save this and send it to whoever you're going with.
  > yard. is coming soon: every Charlotte event and which friends are going. Follow @yard.irl so you never miss a weekend. ✦
  > #cltevents #charlotteevents #thingstodoincharlotte #charlottenc #queencity
- **Tag each venue** in the reel (Tag people), which drives reshares.

## Routine (≈30 min a week)
- **Thursday:** weekend reel (main), plus the post and story versions.
- **Monday:** one story poll ("What did you get up to?") or a reshare of a venue's post (tag them).
- Tag the venues in the weekend post; they often reshare, which is the cheapest growth there is.
- Reply to every comment and DM in the first month.
