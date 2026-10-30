# Event image review

Reviewed 2026-10-29. Astra visually inspected all 17 images against the event listings and official source associations; all 17 final images were accepted.

- Replaced the generic Live Like Bryant foundation logo with the Harvey Street photo assigned to the exact Visulite event.
- Heist Board Game Speed Dating uses undated official Quirk series artwork, not a date-specific event poster. The organizer lists ages 25–39; the event description reflects that.
- Officially assigned performer photographs are attributed from their venue listings, not identified from faces.
- Full per-image provenance, source URLs, local files and review results are in manifest.json. Open index.html for an uncropped visual review.

## Inbox support

Optional image_url accepts HTTPS URLs up to 2048 characters and is retained in pending submissions. The documented moderation SQL copies it into events.image_url on approval. Existing image-free submissions remain valid and fingerprint deduplication is unchanged.

Migration 20261030070000_agent_inbox_images.sql and the updated agent-inbox function were deployed to lvgmelaavgmyjjdggzop. Live function status ACTIVE; unauthenticated requests return 401. No authenticated event submission was performed.

## Validation

- 17 events, 17 approved image URLs; actual inbox validator passed; zero duplicate fingerprints; payload within limits.
- 38 Deno tests passed (12 inbox validation, 26 upstream SerpApi mapping).
- 15 scoped pgTAP checks passed in a rollback transaction, including image constraints and copying into curated events; test event removal was verified.
- Mobile typecheck and lint passed. All 312 mobile tests passed; Jest retained an open handle after completing, and its test process was stopped.
- Database types were regenerated from the linked schema; subsequent mobile typecheck passed.

The events remain local in events.json. No events were submitted, approved, or published.

## Submission update

Submitted all 17 events at the owner’s explicit request. Inbox response: 17 inserted, 0 duplicates, 0 rejected. Read-only database verification confirmed 17 pending rows with all 17 image URLs preserved. Nothing published. See submission-receipt.json.


## Publication update

At the owner's explicit request, all 17 submissions were approved: 16 new curated events were created and the existing Dia de Muertos event was updated in place to avoid a duplicate. All 17 were verified active and returned by the app's feed function, with matching reviewed images/times, venue locations, and categories. Camp North End entries use a corroborated campus pin. See approval-receipt.json and approval-plan.json.

