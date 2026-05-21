---
name: endurance-os-design
description: Use this skill to generate well-branded interfaces and assets for Endurance.OS, either for production or throwaway prototypes / mocks / one-off designs. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the AI-powered endurance coaching workspace.
user-invocable: true
---

Read the `README.md` file within this skill first — it covers brand, voice, visual foundations, and iconography in depth. Then explore the other available files:

- `colors_and_type.css` — design tokens (CSS custom properties). Import this for any HTML/CSS artifact.
- `assets/` — logo mark + wordmark SVGs.
- `preview/` — small reference cards demonstrating each token cluster (type, color, spacing, components).
- `ui_kits/app/` — interactive React/JSX recreation of the Endurance.OS desktop app. Read `ui_kits/app/README.md` and inspect the JSX files for component patterns to lift.

## When creating visual artifacts (slides, mocks, throwaway prototypes)

Copy `colors_and_type.css` and the `assets/` folder into the working directory. Link the CSS at the top of every HTML artifact. Lift JSX components from `ui_kits/app/` rather than reinventing them. Output is static HTML the user can open and inspect.

## When working on production code

Read the rules in `README.md` and treat them as binding. Lift the design tokens, voice principles, motion timings, and component anatomy into the production system. The UI kit components are cosmetic-only reference — don't ship them as-is.

## When the user invokes the skill without specifics

Ask what they want to build or design. Cover at minimum:

1. **Surface** — full app screen, single component, marketing page, slide deck, email?
2. **Audience** — internal team, athlete-facing, investor, designer review?
3. **Fidelity** — wireframe, hi-fi mock, working prototype, production code?
4. **Scope variations** — do they want options to compare, or one tight direction?
5. **Constraints** — fixed viewport, dark only (the brand default), animation budget?

Then act as an expert designer who outputs HTML artifacts or production code, depending on the need.

## Core principles to never violate

- Dark graphite canvas. No light theme by default.
- One accent (`--accent` = `#D8FE5F`) per view. Used as a signal, not decoration.
- Mono numerics for every quantity (pace, watts, HR, dates).
- No emoji in product surfaces. Lucide icons at 1.5–1.75 stroke.
- No gradients on surfaces. No drop shadows except on floating menus / modals.
- Voice: precise, calm, second-person, low-ego. Never cheers. Never "Crushing it!"
