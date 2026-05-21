# Endurance.OS — Design System

> The endurance coaching operating system for serious self-coached athletes.

Endurance.OS is **not a fitness app**. It is a premium productivity workspace for endurance coaching intelligence — a calm, dense, keyboard-driven environment where athletes design plans, review sessions, and converse with an AI coach that knows the full context of their training. Think: *Linear for your training brain.*

The product is desktop-first, dark-by-default, and built around the rituals of a self-coached athlete: morning readiness check, weekly plan review, post-session debrief, race-prep deep-work.

## Source materials

This system was authored from scratch — no codebase, Figma file, or pre-existing brand was provided. The visual direction is anchored on three reference products the user explicitly named:

- **Linear** — https://linear.app/ — primary inspiration. Graphite canvas, micro-typography, single-pixel borders, command-K worldview.
- **Superhuman** — https://superhuman.com/ — typographic confidence, generous spacing, premium feel.
- **Notion** — https://www.notion.com/ — calm density, soft surfaces, readability over chrome.

> ⚠️ **Caveats for the reader:** Since no source product exists yet, every token, component, and screen here is a *proposal*. Treat this as a v0 brand bible — the place to push back and iterate.

---

## Index

| File / folder | What's in it |
| --- | --- |
| `README.md` | This file. Brand, content, visuals, iconography. |
| `SKILL.md` | Agent Skill entrypoint — read this if you're an AI working *with* this system. |
| `colors_and_type.css` | All design tokens (CSS custom properties) — colors, type, spacing, radii, shadows, motion. |
| `fonts/` | Self-hosted webfont files. |
| `assets/` | Logos, brand marks, illustrations. |
| `preview/` | Design System tab cards — one per concept (type scale, color ramp, button, etc.). |
| `ui_kits/app/` | The Endurance.OS desktop app UI kit — pixel-fidelity React/JSX recreations of every core screen. |

---

## Content fundamentals

Endurance.OS speaks like a **head coach who happens to be a great writer**: precise, grounded, calm, with the occasional dry observation. It never cheers. It never says "Let's crush it." It does not motivate you — it *informs* you, and trusts you to do the work.

### Voice principles

1. **Plain numbers, plain words.** "Threshold pace, 4:08/km. Held it for 18 of 20 min." — not "🔥 You SMASHED your threshold!"
2. **Second person, low ego.** "You're trending under recovered." — not "I think you might be tired."
3. **The AI coach has opinions, briefly.** It explains *why*, then stops. No essays. No hedging stack-ups ("It could be that, but also...").
4. **Dates and units are precise.** `Tue · 06:30` · `4:08/km` · `285 W` · `TSS 78`. Never "this morning" when "Tue 06:30" is available.
5. **No emoji in product copy.** Iconography handles affect.
6. **Title case for objects, sentence case for actions.** `Today's Session`, `Plan DNA`, `Race Prep` — but buttons say `Open session`, `Add note`, `Mark complete`.

### Tone examples

| Avoid (generic SaaS / fitness) | Endurance.OS |
| --- | --- |
| "Crushing it! 🔥 New PR!" | "New 20-min power best: 312 W (prev. 305, Mar 14)." |
| "Time to recover, champ 💪" | "HRV is 8% below 14-day baseline. Z2 or off." |
| "Let's plan your week!" | "Week 11. Build week, 2 of 3. Key session: Thu threshold." |
| "Oops, something went wrong" | "Couldn't reach Garmin. Last sync 11 min ago." |
| "Welcome back!" | "Tue, June 3. You logged out at 21:47 yesterday." |

### Microcopy patterns

- **Empty states** describe the next action, not the absence. `No sessions yet. Import from Garmin, TrainingPeaks, or Strava.`
- **Loading** is silent — a 1px progress line at the top of the panel, no "Loading..." copy.
- **Errors** state the fact, the cause, the fix. `Sync failed. Token expired. Reconnect Garmin.`
- **Confirmations** describe the resulting state. `Plan saved. Active from Mon, June 9.` Not "Success!"

---

## Visual foundations

The system is built on a **single graphite canvas**, **one accent**, and **a strict type stack**. Everything else is restraint.

### Surface system

Dark graphite, four tiers. No pure black, no gradient backgrounds, no glass — surfaces are flat and earn depth from borders, not shadows.

| Token | Hex | Use |
| --- | --- | --- |
| `--bg-0` | `#08090A` | Application canvas |
| `--bg-1` | `#0E0F11` | Sidebar, panels |
| `--bg-2` | `#16181C` | Cards, raised surfaces |
| `--bg-3` | `#1E2025` | Hover, input fields |
| `--bg-4` | `#262931` | Pressed, selected row |

### Borders

Borders do the work shadows would do in a light theme. Always 1px, always one of three weights.

- `--border-subtle` (`#1A1C20`) — dividers inside the same surface (table rows, list separators).
- `--border-default` (`#26292F`) — card edges, input outlines, sidebar/main divide.
- `--border-strong` (`#3A3F47`) — focused inputs, selected cards, key actions.

### Type

| Family | Use | Source |
| --- | --- | --- |
| **Geist Sans** | All UI, body, headings | Google Fonts (variable) |
| **Geist Mono** | Numbers, units, pace, power, HR, code, timestamps | Google Fonts |

Display sizes are tight (-2% to -3% letter-spacing); body is neutral; mono is used **liberally** for any quantity — pace, watts, HR, TSS, elevation, dates. Mono numerics are a load-bearing part of the brand.

> 📝 **Font substitution flag:** I chose Geist (the Vercel/Google Fonts family) because it captures the Linear/Superhuman feel without being Inter. If you have a different family in mind — Söhne, General Sans, HK Grotesk, Aeonik — drop the `.woff2` files in `fonts/` and update `--font-sans`.

### Color accent

A single brand color carries the work: **`--accent`** = `#D8FE5F` — an electric lime that reads as *signal*, *power meter*, *go*. Used for: brand mark, primary buttons, focus rings, the current-day indicator on the calendar, the AI coach's send arrow. Used sparingly — typically one accent element in view at a time.

A secondary **AI surface** color, `--ai` = `#8B7CF6` (calm violet), distinguishes anything the AI Coach is doing (its bubble, its inline suggestions). The violet says "machine intelligence" without resorting to purple gradients or stars.

### Training-zone palette (semantic, data-only)

Five fixed colors for Z1–Z5. Used in plots, calendar pills, session summaries — never in UI chrome.

- Z1 `#5C6470` · Recovery
- Z2 `#3FB37F` · Endurance
- Z3 `#E8C547` · Tempo
- Z4 `#E89B3C` · Threshold
- Z5 `#E5484D` · VO2 / Anaerobic

### Spacing

A `4px` base grid. Tokens: `2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. The room between elements is wider than most SaaS — closer to Superhuman than to Linear. Cards have **24px** internal padding minimum.

### Radii

| Token | Px | Use |
| --- | --- | --- |
| `--radius-1` | 4 | Inputs, pills, tags |
| `--radius-2` | 6 | Buttons, menu items |
| `--radius-3` | 10 | Cards, panels |
| `--radius-4` | 14 | Modals, large sheets |
| `--radius-full` | 999 | Avatars, indicator dots |

Radii are **conservative** — nothing softer than 14px. We never use pill buttons (no `border-radius: 999` on a button).

### Backgrounds

- **No gradients** on surfaces. Period.
- **No images** in product chrome. The only imagery in the product is athlete data — sparklines, heatmaps, route maps, elevation profiles.
- **No textures, no grain, no noise.**
- **One exception:** Marketing/empty-state hero artwork may use a subtle dot-grid (`--bg-2` on `--bg-0`, 24px spacing, 1px dots).

### Motion

Animation is **fast and quiet**. The product never bounces, never overshoots.

- **Duration:** `120ms` micro, `180ms` standard, `260ms` panel reveals. Nothing longer than `300ms`.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (a soft ease-out) for almost everything. Linear for progress bars.
- **What animates:** opacity, transform (translate / scale ≤ 1.02), `filter: blur` on backdrops. Not colors, not heights (we measure-and-set, not animate).
- **No spinners.** A 1px indeterminate bar at the top of the relevant panel.
- **AI coach typing:** three dots, `--ai` color, 320ms staggered pulse.

### States

| Action | Effect |
| --- | --- |
| Hover (button) | bg lightens by ~6% (next surface tier up), 120ms |
| Hover (row) | bg → `--bg-3`, 120ms |
| Press | scale 0.98, 80ms, NO color change |
| Focus | 1.5px ring in `--accent` at 60% opacity, 2px offset |
| Disabled | opacity 0.4, no pointer events |
| Selected (row, day) | bg → `--bg-4`, 1px `--border-strong` left edge |

### Shadows

Almost none. Surfaces stack via borders, not elevation. The **only** shadow we use is on floating menus and modals:

- `--shadow-pop` = `0 8px 24px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.6), 0 0 0 1px var(--border-default)`

No inner shadows. No colored shadows. No glow.

### Transparency & blur

- Backdrops behind modals: `rgba(8, 9, 10, 0.72)` with `backdrop-filter: blur(8px)`.
- Sidebar and command palette are **solid** — no acrylic, no translucency on chrome.
- Sparklines and chart overlays use 12–24% opacity fills over their stroke color.

### Cards

A card is: `--bg-2` background, `1px solid --border-default`, `--radius-3` corners, `24px` padding. No shadow. Card titles are `12px / uppercase / +6% tracking / --fg-3`, sat tightly to the top-left. Card body content begins 12px below the title.

### Layout

- **Sidebar:** fixed `240px` width, `--bg-1`, no border-right (subtle 1px in `--border-subtle` only on scroll).
- **Main workspace:** fluid, `max-width: 1280px`, centered. Outer page padding `32px`.
- **Right contextual panel:** fixed `360px`, hideable. Slides in from right, `260ms`.
- **Top bar:** none in the app. Page title sits inline at the top of the workspace. (Linear-style.)

---

## Iconography

We use **Lucide** (https://lucide.dev/) — same family Linear uses (a fork of Feather). 1.5px stroke, 16px and 20px sizes, rounded line caps and joins.

- **Sizes:** `16` (inline with body text, in menus), `20` (sidebar nav, buttons), `24` (rare — page-level glyphs).
- **Color:** icons inherit `currentColor`. Sidebar icons are `--fg-3`; selected nav icon is `--fg-1`. Action-button icons match their button's text color.
- **Stroke:** Always 1.5. Never fill icons (no solid variants).
- **Custom icons:** when Lucide doesn't have what we need (e.g. *Plan DNA* helix, *Race Prep* flag), we draw a 20×20 SVG matching Lucide's stroke spec exactly. These live in `assets/icons/`.

**Loaded via CDN:**

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

**No emoji in product surfaces.** Unicode dingbats (· • → ↗) are fine in microcopy and breadcrumbs.

---

## What's in `ui_kits/`

| Kit | What it shows |
| --- | --- |
| `ui_kits/app/` | Endurance.OS desktop app — dashboard, sidebar, AI coach panel, calendar, readiness cards, session reviews. Interactive click-thru. |

Only one kit, because only one product exists. A marketing site, mobile companion, and onboarding flow are explicit *out of scope* until the user asks.

---

## Open questions for the user

1. **Font.** Geist is a placeholder for a premium feel. If you want Söhne, General Sans, HK Grotesk, or something custom, point me at the files.
2. **Accent.** `#D8FE5F` (electric lime) — keep, swap for violet/indigo (more Linear), or warm amber (more Strava-adjacent)?
3. **Logo.** I drew a placeholder monogram. If you have a real mark, drop it in `assets/`.
4. **Mobile companion app.** In scope eventually? Not designed here.
5. **Light theme.** Not designed. The brief was dark-only — confirm.
