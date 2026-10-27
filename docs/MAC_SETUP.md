# Mac setup

You need a Mac (Apple Silicon recommended) on the latest macOS that runs **Xcode 26.x**. iOS apps can't be built on Linux or Windows.

## 1. Apple tooling
1. Install **Xcode 26.x** from the Mac App Store. Open it once, and install the iOS 26 simulator when prompted.
2. `xcode-select --install` (command line tools).
3. Enroll in the **Apple Developer Program** ($99/yr). It's needed for push notifications, Sign in with Apple and TestFlight. Enrollment can take a day or two, so start now.
4. In Xcode › Settings › **Intelligence**, turn on **Model Context Protocol**. This is what lets Claude talk to Xcode.

## 2. Command line tools
```bash
# Homebrew: https://brew.sh
brew install git gh node supabase/tap/supabase
brew install --cask orbstack   # or Docker Desktop; needed for `supabase start`
gh auth login
```

## 3. Claude Code
Install Claude Code using the current instructions at https://code.claude.com/docs, then from the repo root:

```bash
cd plans-app
claude
```

### MCP servers (run in your terminal, in the repo)
```bash
# Build/run/test/screenshot the iOS simulator (most important)
claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest mcp

# Apple's Xcode MCP: SwiftUI previews + Apple docs search (needs the Intelligence toggle above)
claude mcp add --transport stdio xcode -- xcrun mcpbridge

# Supabase (hosted, OAuth login on first use via /mcp). Pin it to the staging project and read-only at first.
# Copy the exact command for Claude Code from Supabase's MCP docs: https://supabase.com/docs/guides/getting-started/mcp
```
Verify with `claude mcp list`. Xcode may show a dialog asking to allow the connection; allow it.

### Plugins (run inside Claude Code)
```
/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills

/plugin marketplace add dpearson2699/swift-ios-skills
/plugin install swiftui-skills@swift-ios-skills
```
- **Karpathy skills:** behavioral guardrails (think first, simplicity, surgical diffs).
- **swift-ios-skills:** start with the `swiftui-skills` bundle, not `all-ios-skills`, to keep context lean. Add individual skills (`mapkit`, `eventkit`, `push-notifications`, `swiftui-liquid-glass`) in the week you need them.
- **Ponytail** (`/plugin marketplace add DietrichGebert/ponytail`): hold off. Add it only if the code starts feeling over-built. It overlaps with Karpathy's "Simplicity First", and it needs `node` on PATH plus a hooks review in `/hooks`.

Read each plugin's files before installing. They run inside your agent.

## 4. Accounts (free tiers)
| Service | What to do | Cost |
|---|---|---|
| Supabase | Create `staging` project (and later `prod`) | Free → Pro $25/mo at launch |
| Stream | Sign up, then apply for the **Maker Account** (free under 5 people, $10k/mo revenue, 2,000 chat MAU) | Free |
| Ticketmaster | developer.ticketmaster.com → create an app → Consumer Key | Free |
| SeatGeek | seatgeek.com/build → client ID (stretch) | Free |
| PostHog | Create a project (US cloud) | Free tier |
| Sentry | Create an iOS project | Free tier |
| GitHub | Repo for this project | Free |

## 5. Create the Xcode project (week 0)
1. Xcode › New Project › iOS App. Product name `PlansApp` (placeholder). Interface SwiftUI, language Swift, **no** Core Data / SwiftData, include Tests.
2. Save it into this repo's `ios/` folder.
3. Target › General: minimum deployment **iOS 26.0**. Build Settings: **Swift Language Version 6**.
4. Signing & Capabilities: add **Sign in with Apple**, **Push Notifications**, **Background Modes › Remote notifications**.
5. Info.plist privacy strings: `NSLocationWhenInUseUsageDescription`, `NSContactsUsageDescription`, `NSCalendarsWriteOnlyAccessUsageDescription`, `NSPhotoLibraryUsageDescription`.
6. Add packages one at a time, when the feature needs them (see `ARCHITECTURE.md`).
7. Ask Claude: *"Build and run the app on the iPhone 17 simulator with XcodeBuildMCP and take a screenshot."* If that works, you're set up.

## 6. Local backend
```bash
supabase init            # only if supabase/config.toml doesn't exist yet
supabase start           # local Postgres + Studio at http://localhost:54323
supabase db reset        # applies migrations
supabase test db         # runs pgTAP tests (should print 31 passing)
supabase link --project-ref <staging-ref> && supabase db push   # deploy schema to staging
```

## 7. Learning Swift alongside (about 30 min/day)
- Apple's **SwiftUI Tutorials**: developer.apple.com/tutorials/swiftui
- **Hacking with Swift: 100 Days of SwiftUI** (Paul Hudson). Do days 1–15 for the language basics.
- WWDC25 sessions: *Meet Liquid Glass*, *Build a SwiftUI app with the new design*, *What's new in SwiftUI*.
- When Claude writes something you don't understand, ask *"explain this like I'm new to Swift"*. CLAUDE.md tells it to do that unprompted for new concepts.
