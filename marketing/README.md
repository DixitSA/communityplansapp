# Yard marketing

Local preparation for the Instagram/Facebook rebrand. Nothing here has been published or approved.

- `brand/`: upload-ready avatar, Facebook cover, wordmark and five highlight covers (PNG and editable SVG).
- `content/launch-drafts.json`: nine feed drafts, five Reel scripts/captions and a 30-day proposed editorial calendar.
- `preview/index.html`: offline visual review of rendered feed slides and full copy. Open in a browser after rendering. This is a static review page, not a publishing or approval service.
- `STATUS.md`: verified live-account observations, pending owner handoffs, research sources and remaining integration work.

## Regenerate the assets

From the repository root in PowerShell:

```powershell
& .\marketing\scripts\render-yard-brand.ps1
& .\marketing\preview\render-drafts.ps1
```

These use built-in Windows drawing facilities and installed system fonts. They do not call paid image or language-model APIs. Source copy and review work used cheaper-model subagents. Rasterize from these same source scripts whenever copy changes, then review again.

## Human publishing approval

Drafts are not permission to publish. Before any publication, review the complete final media and caption, specific account/platform, publication type, and proposed time. A future publishing service must bind approval to that exact revision and invalidate it if anything material changes. Do not infer approval from a calendar entry, generated file, review-page visit, or agent review.

The current live account must be confirmed by the owner before it is repurposed. Follow `STATUS.md` for the current handoff. Do not change the username, ownership, or account visibility without the owner's specific permission.
