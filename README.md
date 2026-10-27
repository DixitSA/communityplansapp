# yard.

An iOS-first app for making plans and meeting people in real life. It combines the event discovery of Partiful and Eventbrite, the social graph of Instagram, and the simplicity of Apple Calendar.

**v1:** Charlotte, NC · Expo / React Native (native iOS 26 UI, Liquid Glass) · Supabase · Stream Chat · built on Windows, shipped via EAS · target launch late January 2027.

| Doc | What's in it |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, users, metrics, features, plan states, privacy, event supply, launch |
| [docs/DESIGN.md](docs/DESIGN.md) | Design principles, references, tokens, signature interactions, screen inventory, Expo implementation map |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | App structure, packages, Supabase, Edge Functions, Stream, analytics, testing |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Tables, privacy matrix, how clients read and write |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Week-by-week plan, cut list, working rhythm |
| [docs/DEV_SETUP.md](docs/DEV_SETUP.md) | Windows + iPhone setup, accounts, Claude Code plugins, EAS builds |
| [docs/AGENTS.md](docs/AGENTS.md) | Agent team (builder / runner / judge), review loop, cost controls |
| [CLAUDE.md](CLAUDE.md) | Instructions for Claude Code |

## Status
- [x] Planning package
- [x] Schema + RLS + privacy tests (`supabase/`): 33/33 passing, run in CI on every PR
- [x] Expo app scaffold + week-1 design system, Feed shell and `/gallery` (judge PASS 8/10)
- [ ] Owner check in Expo Go on iPhone (light + dark)
- [ ] Week 2: auth + onboarding
