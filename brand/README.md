# Shlep brand assets

Generated 2026-07-25. Source SVGs are the master files — re-render PNGs from them.

## For Stripe (Settings → Business → Branding)
| Field | File |
|---|---|
| Icon (square, ≥128px) | `shlep-icon-512.png` |
| Logo (wordmark) | `shlep-logo.png` (paper bg) or `shlep-logo-transparent.png` |
| Brand color | `#14532D` |
| Accent color | `#E0A32E` |

## Files
- `icon.svg` → `shlep-icon-128/512/1024.png` — forest-green rounded square, amber S-Route mark. Works as app icon / favicon / avatar.
- `logo.svg` → `shlep-logo.png` — wordmark on paper `#F3EFE6`.
- `logo-transparent.svg` → `shlep-logo-transparent.png` — same, transparent background (use on light surfaces).
- `logo-dark.svg` → `shlep-logo-on-dark.png` — light text version for dark backgrounds.

## Palette
| Role | Hex |
|---|---|
| Accent (primary) | `#E0A32E` |
| Accent deep (text on light) | `#B98114` |
| Forest green (brand) | `#14532D` |
| Ink | `#17160F` |
| Paper (background) | `#F3EFE6` |
| Card surface | `#FBFAF4` |

⚠️ Contrast: amber `#E0A32E` needs **dark** text on it, never white. For a solid button with white text use forest green `#14532D`.

## Known limitation
The wordmark PNGs were rendered without **Bricolage Grotesque** installed, so the "hlep" letterforms fall back to a generic heavy sans — close, but not identical to the website. To produce a pixel-accurate wordmark, open `logo.svg` in a tool that has Bricolage Grotesque (or install the font) and re-export, or convert the text to outlines. The **icon has no text and is exact.**
