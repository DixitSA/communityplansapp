# Dev setup: Windows + iPhone

You build on **Windows**, test on **your iPhone** (iOS 26), and Expo's cloud (EAS) does the macOS-only steps: native builds, signing, TestFlight and the App Store. No Mac required. If you get one later, the same code just gains a local simulator.

## How the loop works
```
Windows: you + Claude Code edit TypeScript
   └─ `npx expo start` (Metro dev server)
         └─ iPhone: development build app reloads in ~1 s on every save (same Wi-Fi, or --tunnel)

Native changes (new native package, app.config.ts plugins, icons) →
   `eas build --profile development --platform ios` → install on iPhone (~15–25 min, cloud)
Release → `eas build --profile preview` + `eas submit` → TestFlight
```
You only need a new cloud build when **native** code changes. That's roughly a few times a month, well inside EAS's free tier.

## 1. Windows tools
1. **Git for Windows**: git-scm.com (also gives you Git Bash, which Claude Code uses).
2. **Node.js LTS**: nodejs.org.
3. **VS Code** (optional, nice for reading code): code.visualstudio.com.
4. **Claude Code**: install using the Windows instructions at https://code.claude.com/docs.
5. **GitHub CLI** (optional): `winget install GitHub.cli`, then `gh auth login`.
6. Clone the repo:
   ```powershell
   git clone https://github.com/DixitSA/communityplansapp
   cd communityplansapp
   ```
7. **Docker Desktop** is *optional*. You only need it to run Supabase locally. Database tests already run in GitHub Actions on every PR, and you can develop against the hosted `staging` project.

## 2. iPhone
1. Turn on **Developer Mode**: Settings › Privacy & Security › Developer Mode, then restart. The setting only appears after a development build has been installed once, so do this step in §5.
2. Install **Expo Go** from the App Store. You'll use it in week 0 before your Apple Developer account is ready.
3. Keep the phone on the same Wi-Fi as your PC. If your network blocks that, use `npx expo start --tunnel`.

## 3. Accounts
| Service | What to do | Cost |
|---|---|---|
| **Apple Developer Program** | Enroll at developer.apple.com. It takes 1–2 days, so **start today** | $99/yr |
| **Expo** | Sign up at expo.dev (free plan: ~15 iOS cloud builds/mo) | Free |
| Supabase | Create `staging` project (later `prod`) | Free → Pro $25/mo at launch |
| Twilio (for phone OTP) | Connect it in Supabase › Auth › Phone. Needed for phone sign-in / contact discovery | ~$1–5/mo at beta scale |
| Stream | Sign up, apply for the **Maker Account** (free under 5 people, $10k/mo revenue, 2,000 chat MAU) | Free |
| Ticketmaster | developer.ticketmaster.com → create an app → Consumer Key | Free |
| SeatGeek | seatgeek.com/build → client ID (stretch) | Free |
| PostHog / Sentry | Create projects | Free tiers |

## 4. Claude Code setup (run inside Claude Code in the repo)
```
/plugin marketplace add expo/skills
/plugin install expo

/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills
```
- **Expo skills** are official skills from the Expo team: native UI, Expo Router, native tabs, animations, EAS builds and deployment. They're tuned for Claude.
- **Karpathy skills** are behavioral guardrails: think first, keep it simple, make surgical diffs.
- **Supabase MCP:** add the hosted server, pinned to your `staging` project and read-only to start. Copy the Claude Code command from https://supabase.com/docs/guides/getting-started/mcp, then run `/mcp` to log in.
- **Ponytail** (`DietrichGebert/ponytail`): hold off. Add it only if the code starts feeling over-built.

Read each plugin's files before installing. They run inside your agent.

**Showing Claude the app:** take a screenshot on your iPhone, AirDrop or sync it to your PC, and drag the image file into the Claude Code prompt. Do this after every UI change. It's the visual check Claude can't do on its own on Windows.

## 5. Create the app (week 0)
Claude can do these steps for you; they're listed so you know what's happening.
```powershell
npx create-expo-app@latest mobile        # default template: Expo Router + TypeScript
cd mobile
npx expo start                           # scan the QR code with the iPhone camera → opens in Expo Go
```
Once your Apple Developer account is active (around week 1–2):
```powershell
npm install -g eas-cli
eas login
eas build:configure                      # creates eas.json
eas device:create                        # registers your iPhone (opens a link on the phone)
npx expo install expo-dev-client
eas build --profile development --platform ios
```
Install the build from the link EAS gives you, enable **Developer Mode** when iOS asks, then:
```powershell
npx expo start                           # the dev build connects to this; edits reload instantly
```

## 6. Environment variables
- Create `mobile/.env` (gitignored) with:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
  EXPO_PUBLIC_STREAM_API_KEY=<stream key>
  ```
- Add the same values in the EAS dashboard (Environment variables) for cloud builds.
- Server secrets (Stream secret, Ticketmaster key, contact pepper, Expo push access token) go in **Supabase › Edge Functions › Secrets**. They never go in the app or git.

## 7. Backend from Windows
```powershell
npx supabase login
npx supabase link --project-ref <staging-ref>
npx supabase db push                     # apply migrations to staging
npx supabase gen types typescript --linked > mobile/src/lib/database.types.ts
npx supabase functions deploy <name>     # Edge Functions
```
- **Database tests:** run automatically on every pull request (GitHub › Actions › "Database tests").
- To run them locally you need Docker Desktop, then `npx supabase start` and `npx supabase test db`.

## 8. Learning alongside (about 30 min/day)
- **Expo tutorial**: docs.expo.dev/tutorial/introduction. Build the sample app once, end to end.
- **React Native basics**: reactnative.dev/docs/getting-started (components, styling, Flexbox).
- **TypeScript for JS programmers**: typescriptlang.org/docs (the 5-minute and handbook basics).
- **Expo Router** docs: navigation, native tabs, sheets, links.
- When Claude writes something you don't understand, ask *"explain this like I'm new to React Native"*. CLAUDE.md tells it to do that unprompted for new concepts.
