---
name: lbg-style
description: Apply the Lloyds Banking Group visual style (greens, typography, buttons, logo, Cancara pattern, icons) to UI work. Use this whenever you build or restyle screens, components, pages or anything visual in this app, or when someone asks for "LBG style", "brand", "on-brand", "make it look like Lloyds", or wants a logo or icons.
---

# Lloyds Banking Group style

This skill matches the look of https://www.lloydsbankinggroup.com, captured in Nov 2026. Everything needed is in `assets/` next to this file:

| File | Use |
|---|---|
| `assets/tokens.css` | Colours, type, radii, spacing, plus ready-made `.lbg-btn`, `.lbg-card` and `.lbg-surface--*` classes |
| `assets/logos/lbg-logo.svg` | Full-colour logo (green horse, black wordmark) for light backgrounds |
| `assets/logos/lbg-logo-white.svg` | All-white logo for green or dark backgrounds |
| `assets/logos/lbg-logo.png`, `favicon.ico` | Raster logo and favicon |
| `assets/patterns/cancara-pattern*.png` | The two-tone green "Cancara" brand pattern, for hero or header backgrounds |
| `assets/icons/*.svg` | The site's own line icons: arrows, chevrons, close, plus/minus, calendar, location, ticks, info, warning, play, quote, download |

## How to apply it

1. **Copy, don't link.** Copy `tokens.css` and any assets you need into the app's own static or asset folder (for example `public/brand/`), then import `tokens.css` once at the root. Never hotlink lloydsbankinggroup.com.
2. **Use the tokens.** Reference `var(--lbg-…)` and never hard-code hex values. If the app uses Tailwind, map the tokens in `tailwind.config` (`colors.lbg.heritage = 'var(--lbg-heritage-green)'` and so on) instead of inventing new colours.
3. **Fix the `.lbg-surface--pattern` path** in `tokens.css` if the pattern image ends up somewhere else relative to the CSS.

## The look in brief

- **White canvas, black text.** The site is mostly white with black type. Greens are for brand moments, not every element.
- **Three core greens:**
  - Heritage `#006a4d` is the main brand surface.
  - Racing `#024731` is for deep hero or header backgrounds.
  - Everyday `#11b67a` is for icons and highlights.
  - Bright accent `#0be248` is for at most one call-to-action per screen.
  - Links are `#00864f`.
- **Buttons:**
  - The primary button is **black with white text**, not green.
  - Secondary buttons are outlined in black.
  - The accent button (bright green fill, black text) is for the hero action only.
  - All buttons have 12px radius, bold 18px text, 48px or more height, underline on hover, and `#f1f1f1`/`#767676` when disabled.
- **Shape:**
  - Cards and sheets: 16px radius with a soft shadow `0 2px 8px rgba(0,0,0,.08)`.
  - Buttons and inputs: 12px radius.
- **Type:**
  - Headings are heavy and tight (Median Bold); body text is Standard Regular.
  - The real font, GT Ultra, is licensed and not included. The token stack falls back to system fonts. Don't add GT Ultra files to the repo.
- **Dark sections:** use a heritage or racing green background (or the Cancara pattern) with white text, the white logo and the `.lbg-btn--on-dark` button.
- **Icons:** use the SVGs in `assets/icons/` at 20–24px. Pick the `-white` variants on green or dark backgrounds. If an icon is missing, use a simple line icon with a similar stroke rather than mixing in filled icon sets.

## Mobile first (hard rule for this hackathon)

- Design for a 360–430px viewport first, then widen.
- Put buttons at full width, with tap targets of at least 44px.
- Keep the primary action in the bottom thumb zone.
- Use a top app bar in white with the colour logo (about 32px tall), or in racing green with the white logo.
- Use the mobile type scale in `tokens.css` (h1 is 36px) and only step up to the desktop sizes noted in comments at 768px and above.

## Accessibility

- White on heritage or racing green, and black on accent or everyday green, both pass WCAG AA.
- **Don't** put white text on `#11b67a` or `#0be248`, because it fails contrast.
- Use `#767676` as the lightest grey for text on white.
- Keep the visible focus ring (`--lbg-focus-ring`).

## Brand-use guardrails

- Leave the logo's proportions and colours alone. Only use the two supplied versions, with clear space of at least the horse's width around it.
- These are real LBG trademarks, copied from the public site for this internal hackathon prototype. Label the app as a prototype or concept and don't make it look like a live production banking service.
- All content shown in the UI must still be synthetic, as the hackathon rules require.
