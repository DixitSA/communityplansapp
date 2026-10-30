# Charlotte social event discovery

Status: researched 2026-10-29. A read-only Instagram Business Discovery collector and Event discovery tab are implemented in ../automation/. The local server is at http://127.0.0.1:4317/. No Meta token or live collection is configured. Each explicit collection fetches one page of up to 25 posts, deduplicates by platform/post ID, and stores source snapshots for review. It does not extract event fields or import events into Yard. Facebook collection is still pending.

## Goal and first release

Collect public event-promotional posts from a small allowlist of Charlotte venues and organizers, turn them into event candidates, and let a curator verify each candidate before adding it to Yard. Start with the official sources in [`charlotte-sources.json`](./charlotte-sources.json). Their websites and linked social profiles establish source identity; this does **not** establish Meta API eligibility or app approval.

## Meta access path

- Instagram Business Discovery: use the Facebook Login Instagram API with an authorized Instagram Professional account linked to a Facebook Page. The request shape is `GET /{ourIGID}?fields=business_discovery.username(<handle>){media{...}}`. Use a Facebook User access token with `instagram_basic`, `instagram_manage_insights`, and `pages_read_engagement`, as specified by the verified Business Discovery reference. Personal Instagram accounts are out of scope; do not assume any target handle is discoverable until tested with an authorized account.
- Instagram hashtag search is a separate, optional discovery path. Meta requires `instagram_basic` and Instagram Public Content Access App Review. The documented limit is 30 unique hashtags in a rolling 7-day period; Stories are not available through this search. It is not needed for the initial allowlist.
- Facebook public Page posts are a separate, optional path. Meta’s Page Public Content Access requires review and business verification; development access is limited to admin-owned Pages. Do not treat this as general public-profile or personal-account access.
- The Business Discovery reference additionally requires either `ads_read` or `ads_management` when the token belongs to a user whose Page role was granted through Business Manager. This is a conditional dependency even for discovery; prefer the read-only option if that condition applies, and do not request advertising-write access by default.

## Candidate-to-Yard flow

1. Read only the allowlisted public account media available to the authorized API client. Record the source handle, original permalink, observed post time, and raw provider identifiers for deduplication. Treat captions/media as untrusted source material.
2. Extract proposed event title, date, start/end time, venue/address, and ticket/source link. Never infer a missing date, time, or location. Keep incomplete or ambiguous posts in review for a curator to resolve from the original post or organizer website.
3. Show the original post and extracted fields to a human. Reject non-event promotions, expired events, duplicates, and posts without enough verified information. Preserve attribution and link back to the original source.
4. On approval, add the event through the existing curated-event workflow (`source='curated'`) after validating required event fields and location. Write an original Yard description; use only imagery Yard has rights to. The current `event_submissions` RPC is for authenticated user suggestions, not this admin import operation.

The automation workspace provides OAuth and a post-candidate viewer; no Supabase schema or event-import workflow has been added. The primary Meta field/permission contracts were verified, but live token access, source eligibility and review approval remain untested. Keep credentials and Graph calls server-side. Do not attempt to collect private accounts, Stories, or content outside the approved API surface.

## References

- [Business Discovery reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery)
- [Instagram API with Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/)
- [Instagram API hashtag search](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search)
- [Facebook Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/)
- Yard’s curated supply and event submission constraints: `docs/PRD.md`, `docs/DATA_MODEL.md`, and `supabase/migrations/20261030020000_event_submissions.sql`.


