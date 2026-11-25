# yard trailer

A 30-second vertical (1080×1920, 9:16) trailer for yard, made with [Remotion](https://www.remotion.dev). It's sized for Instagram Reels, TikTok and Stories.

## Scenes
1. Hook: "it's friday night. what are we doing?"
2. City montage: "charlotte has live music / food trucks / warehouse parties / game day / art nights"
3. Feed: "everything happening in charlotte. one feed."
4. Event page with the friends row ringed: "see which friends are going."
5. Going tap with a burst: "tap Going. you're in."
6. Chat: "the plan happens in the chat."
7. Profile: "Interested stays yours. only you see it."
8. End card: "yard. find your people." with "charlotte · coming soon on the App Store"

## Run it (PowerShell, from `trailer\`)
```powershell
npm install
npm run studio    # live preview in the browser
npm run render    # writes out\yard-trailer.mp4
```

## Change it
- Copy and timing: `src/Trailer.tsx`, with scene lengths in `src/theme.ts`.
- App screens: `public/*.png`. These are demo-mode captures from `mobile/scripts/screenshot.cjs`, so they contain no real user data. Re-capture them after UI changes.
- Music: there is none yet. Drop a licensed track in `public/` and add `<Audio src={staticFile('track.mp3')} />` inside `Trailer`.

## Credits and licenses
- City photos are from Pexels (free for commercial use; see `mobile/assets/stock/CREDITS.md`):
  - Andrius Šimkus (music)
  - August de Richelieu (food)
  - Maor Attias (nightlife)
  - Kampus Production (sports)
  - christian hembert (arts)
- Inter font: SIL Open Font License.
- Remotion is free for individuals and companies of up to 3 people. Larger teams need a company license (remotion.pro).
