# yard brand assets

These reusable social assets follow the app's v2 direction: a warm cream canvas, forest green, and the same bold lowercase `yard.` wordmark shown in the product mockup. The logo is set in Segoe UI Bold, using the Windows system font; SVG files remain editable vector artwork and use a system font stack.

## Files

- `yard-wordmark.svg` / `.png` — standalone wordmark on transparent background.
- `yard-avatar.svg` / `.png` — square profile avatar, designed to remain legible in a circle crop.
- `yard-facebook-cover.svg` / `.png` — 1640 × 624 cover with centered safe-area copy: “Find your people.” and “Charlotte, we're building something social.”
- `yard-highlight-start-here`, `-charlotte`, `-plans`, `-people`, and `-building` — square PNG and SVG highlight covers.

## Brand palette

| Color | Hex | Use |
|---|---|---|
| Cream | `#F6F3EC` | Light canvas and reversed type |
| Forest | `#2E5B45` | Wordmark and primary brand color |
| Dark | `#101411` | Dark-mode canvas |
| Mint | `#7FC3A0` | Small accent |

## Type and voice

Use **Segoe UI Bold** for the wordmark and short display labels. Keep the exact lowercase `yard.` spelling. Supporting copy uses Segoe UI regular. The voice is warm, short, a little playful, and never pushy. Prefer “Find your people.” Avoid guilt, inflated promises, or claims that the product has launched.

## Regenerate

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\marketing\scripts\render-yard-brand.ps1
```

The script uses Windows `System.Drawing` and the installed Segoe UI font to render the PNGs. It writes PNG and SVG files to this folder without downloading fonts or adding dependencies.
