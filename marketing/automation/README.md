# Yard marketing automation backend

Local-only review and publishing service. It binds exclusively to `127.0.0.1:4317`, uses Node built-ins only, and stores approvals, decisions, attempts, and encrypted Meta tokens in the ignored `.data/` directory. There are no bundled credentials and OAuth is never initiated automatically; account linking requires an explicit user action.

## Run

1. Use Node 20.6 or newer.
2. Copy `.env.example` to `.env`. OAuth requires a Meta app ID/secret, callback URI registered exactly as `http://127.0.0.1:4317/oauth/meta/callback`, reviewed scopes, and a fresh 32-byte encryption key encoded as 64 hex characters.
3. Start with `npm start` from this folder. Publishing is disabled by default. Keep `YARD_META_PUBLISH_ENABLED=false` until target accounts, permissions, public media hosting, and the Graph contracts have been verified. No credentials are bundled, and this checkout makes no Meta calls on startup.
4. Open `http://127.0.0.1:4317/` for the local review dashboard.

Run the standard-library tests with `npm test`. They use mocked Meta requests and never contact Meta.

## One-shot import of an already-authorized user token

Use only after the account owner explicitly approves this import. The utility reads the token from hidden terminal input (or stdin when piped), validates it with Meta's `debug_token` endpoint for this exact app, confirms it is a valid unexpired `USER` token both before and after long-lived-token exchange, and discovers only the exact Page ID passed on the command line. The matching Page must include a linked Instagram professional account. The selected Page token and user token are stored only inside the existing AES-GCM encrypted state bundle. The utility prints account IDs/count only; it never prints tokens or raw Meta error descriptions. Failed verification does not write connection state.

From this folder, stop the local dashboard first, then run `npm run import-user-token -- --page-id <exact-yard-page-id>` and paste the token at the hidden prompt. Stop/restart matters because the CLI and server are separate processes using the same state file. Do not place the token in command arguments, source files, environment variables, shell history, or chat. A pipe may be used by a secure local secret-input tool; stdin is consumed directly. This is a one-shot local tool and is never invoked by server startup or the dashboard. It makes live Meta calls only when a human runs it after approval; automated tests use mocked Meta responses.

## Safety boundaries

- The server does not bind to LAN/public interfaces. It checks the request host and browser origin.
- Tokens are encrypted with AES-256-GCM. Set a new current key and keep the old key as `YARD_META_TOKEN_KEY_PREVIOUS` during rotation; successfully updated tokens are re-encrypted with the current key. Back up encrypted state before rotating and keep all key material outside the repo.
- The content editor creates a new revision. Approval binds the revision, content SHA-256, destination account, action and scheduled time. Actual media bytes are hashed at approval and rechecked at a hash-addressed URL on the configured immutable public host before execution.
- Feed assets are generated JPEGs. The five Reel MP4s are silent typography-only concept storyboards, labeled in both UI and API. They are not recorded event footage or voiceover.
- Meta Graph API v26.0 is pinned from primary Meta Pages and Instagram docs. Facebook text/photo/carousel and Instagram image/carousel/Reel adapters are implemented. Facebook video and Instagram Stories are unsupported; insights remain unsupported pending a verified metrics contract.
- Instagram Business Discovery is an explicit, read-only action requiring `instagram_manage_insights` in addition to `instagram_basic` and `pages_read_engagement`. It stores at most the first 25 source posts per click in local candidate storage, deduplicates by Instagram post ID, and does not infer event dates, download media, or create Yard events. Add the optional scope to `YARD_META_SCOPES` and reconnect to grant it. Meta may omit `media_url` for some video posts; it is optional.
- Publishing requires both an exact approval and the explicit `YARD_META_PUBLISH_ENABLED=true` flag. An uncertain publish result locks the attempt from retry until reconciled by a human.
- Text generation defaults to provider `none`, no model, no API key, and a $0 budget. `template` can be explicitly selected for local copy transformation. OpenAI generation requires an explicit model, key, monthly budget, input/output token prices and a submitted UI request; a conservative maximum-cost estimate is checked before sending.

Read [API-CONTRACT.md](./API-CONTRACT.md) for routes, payloads, approval states, and unsupported actions.
