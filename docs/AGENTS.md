# Agent workflow

Development runs as a small team of Claude agents. The main session is the **orchestrator**. It plans each slice and writes tight briefs. Cheaper agents do the work, and an Opus **judge** stands in for you wherever a human call is needed.

| Agent | Model | Does | Never does |
|---|---|---|---|
| Orchestrator (main session) | default | Plans slices from MILESTONES, writes briefs, merges results, commits, opens PRs | Long implementation work |
| `builder` | Sonnet, medium effort | Implements one non-UI slice (backend, data layer, migrations, Edge Functions); runs typecheck, lint and tests | Explores beyond the brief |
| `ui-designer` | Sonnet, high effort, with Expo's official UI skills (`expo-native-ui`, `expo-design-system`, `expo-animation`, `expo-ui`, `expo-router`) | Designs and builds screens: writes a design note first, builds native-first, self-critiques once from screenshots | Signs off its own work (the judge does) |
| `runner` | Haiku, low effort | Mechanical commands (installs, checks, exports, screenshots, Supabase CLI) with compact reports | Edits code |
| `judge` | Opus, high effort | Design review from screenshots, diff review, product decisions the docs leave open | Edits code; spends money; changes privacy rules |

Definitions are in `.claude/agents/`.

## The loop for each slice
```
orchestrator brief ─▶ builder implements + checks + screenshots
                         │
                         ▼
                      judge (Opus) ── PASS ──▶ orchestrator commits / PR
                         │
                       REVISE (must-fix list) ─▶ builder (max 2 rounds) ─▶ judge
                         │
                       still failing / ESCALATE ─▶ human
```

## Where the judge replaces you, and where it doesn't
- **Judge decides:**
  - Does this screen meet the DESIGN.md bar?
  - Is this diff correct and safe?
  - Product questions the PRD leaves open, within v1 scope.
- **You decide** (the judge escalates):
  - Anything that costs money or needs an account
  - Changes to the privacy matrix or safety rules
  - Irreversible actions (publishing, App Store, deleting data)
  - Brand and naming
- **Your iPhone check:** the judge sees **web screenshots**, where Liquid Glass, native tabs, SF Symbols and Apple Maps render as fallbacks. Before a milestone is called done, open it in Expo Go and send a screenshot or two. That's the one check that can't be delegated.

## Cost and token measures
1. **Model tiering.** Haiku for mechanical work, Sonnet for implementation, Opus only for judging, about once per slice.
2. **Effort caps.** Set per agent in its frontmatter: low / medium / high.
3. **Turn caps.** `maxTurns` on every agent stops runaway loops.
4. **Tight briefs.** The orchestrator names exact files, doc sections and acceptance criteria, so agents don't read whole docs or wander the repo.
5. **Read denies.** `.claude/settings.json` blocks reading `node_modules`, lockfiles, build output and generated native folders.
6. **Short output.**
   - Agents pipe logs through `tail`/`grep`.
   - `BASH_MAX_OUTPUT_LENGTH` caps tool output.
   - Final reports have word limits (runner 120, builder 200, judge 250).
7. **Bounded review.** At most 2 builder↔judge rounds per slice, then escalate instead of looping.
8. **Parallel only when independent.** Slices that touch different folders run in parallel. Others run one after another, so agents don't duplicate context.
9. **Stable prefixes.** CLAUDE.md and the agent prompts stay short and change rarely, so prompt caching keeps hitting.
10. **Escalate rather than guess.** The judge's ESCALATE list is the human's queue. Everything else keeps moving without waiting.

## Screenshots for the judge
`mobile/scripts/screenshot.mjs` runs the app's web build in headless Chromium:
- iPhone-sized viewport (393×852 @3x)
- light and dark
- one large-text pass

It writes PNGs to `mobile/.screenshots/` (gitignored). It needs Playwright, which is preinstalled in Claude's cloud sessions. On your Windows machine, run `npx playwright install chromium` once if you want to use it locally.
