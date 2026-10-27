# PlansApp (name TBD)

An iOS-first app for making plans and meeting people in real life. It combines the event discovery of Partiful and Eventbrite, the social graph of Instagram, and the simplicity of Apple Calendar.

**v1:** Charlotte, NC · SwiftUI (iOS 26) · Supabase · Stream Chat · target launch late January 2027.

| Doc | What's in it |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, users, metrics, features, plan states, privacy, event supply, launch |
| [docs/DESIGN.md](docs/DESIGN.md) | Design principles, references, tokens, signature interactions, screen inventory |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | iOS structure, Supabase, Edge Functions, Stream, analytics, testing |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Tables, privacy matrix, how clients read and write |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Week-by-week plan, cut list, working rhythm |
| [docs/MAC_SETUP.md](docs/MAC_SETUP.md) | Xcode, Claude Code, MCP servers, plugins, accounts |
| [CLAUDE.md](CLAUDE.md) | Instructions for Claude Code |

## Status
- [x] Planning package
- [x] Initial schema + RLS + privacy tests (`supabase/`): 31/31 passing
- [ ] Week 0: Mac setup + Xcode project
