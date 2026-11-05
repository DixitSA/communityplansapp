# Focused iOS QA without Maestro

`qa-idb.py` drives the already booted iOS Simulator through Meta's `idb` accessibility CLI. It starts Expo Go at the fixed local URL `exp://localhost:8093`, verifies the visible demo-mode disclosure before profile mutation, saves and reopens a QA-marked name, and checks that Nightlife changes the Filters event count and Clear restores it. It does not use an XCTest bundle or Maestro.

## Runner setup

Requirements: an Apple Silicon Mac, macOS 15+, full Xcode 26+, Python 3.10+, a booted simulator with Expo Go, and the app's Expo server at `localhost:8093`. The Expo server must start with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` blank; the script also rejects nonempty values and checks the Settings demo disclosure before writing the demo profile.

Install Meta's unified CLI and companion:

```sh
brew tap meta/fb
brew trust meta/fb
brew install meta/fb/idb
idb --version
```

Run from `mobile/`:

```sh
python3 scripts/qa-idb.py --udid "$SIMULATOR_ID" --results-dir "$RESULTS_DIR"
```

Results contain a `checklist.json`, screenshots for the feed/profile/filter states, and `failure-ax.json` plus `failure.png` on failure. No app build, Expo server bootstrap, package install, or simulator creation is performed by this script.

## Version pin

The current Meta formula set is v1.7.8. To pin both Homebrew formulae and their checked-in artifact SHA-256 values, pin the tap to the reviewed commit before installing:

```sh
brew tap meta/fb
git -C "$(brew --repo meta/fb)" checkout f2c725e984cfaa8e2c648be069f3d63925776c83
HOMEBREW_NO_AUTO_UPDATE=1 brew install meta/fb/idb
```

At that commit the CLI wheel SHA-256 is `ed8557a4c54ffee53006c1fe63f070cda567949312ab24be56faf987c5a3d04b`; the Apple Silicon companion archive SHA-256 is `44369a2df0b62e3a1764de61bd09280999c7e9b27ea8f20bff1ea3a9db0302a2`. The regular install command follows the tap's current formula revision.
