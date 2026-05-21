# Endurance.OS — App UI Kit

A clickable hi-fi recreation of the Endurance.OS desktop workspace — the customizable AI endurance intelligence workspace for advanced self-coached athletes.

## Run it

Open `index.html` in the preview pane. The app boots at the Dashboard with the AI Coach panel docked on the right. Try:

- **`⌘K` (or `Ctrl+K`)** — open the command palette.
- **`⌘/` (or `Ctrl+/`)** — toggle the AI Coach panel.
- **Click sidebar items** — navigate Dashboard / Calendar / Chat / Context / Races / Settings.
- **Dashboard** — Accept / Modify / Reject / Discuss the AI adaptation proposed on Today's Session.
- **Chat** — type `@` in the composer to open the context-tag picker (`@todayshrv`, `@plandna`…). The right pane groups conversations by Today / Yesterday / Last 7 days / Session reviews / Race discussions / Nutrition / Plan adaptations.
- **Context** — 9 editable intelligence modules + Memory Suggestions inbox at the top (Accept / Edit / Reject).
- **Calendar** — click any day to open the workout detail drawer (stats, AI summary, conversation snippets, adaptation notes, reflection).
- **Settings → AI model / API keys / Coach style / Adaptation rules** — bring-your-own-model & rule editor.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell. Routes, keyboard shortcuts, command palette. |
| `Atoms.jsx` | Shared primitives: `Button`, `Pill`, `Card`, `Icon` (Phosphor, `weight` defaults to `light`; `sparkles` / `brain` to `duotone`), `Kbd`, `Avatar`, `Sparkline`. |
| `Sidebar.jsx` | Left nav: 6 routes (Dashboard, Calendar, Chat, Context, Races, Settings) + race countdown. |
| `DashboardView.jsx` | `TodaysSessionCard` with adaptation suggestion strip, `ReadinessRow`, `WeekStrip`, `MemoryInbox`. |
| `ChatView.jsx` | Full-page AI workspace: main thread, context strip, @-tag picker, conversation history sidebar. |
| `ContextView.jsx` | 9 editable AI-intelligence modules + Memory Suggestions inbox. |
| `CoachPanel.jsx` | Right contextual panel — embedded coach across non-Chat routes. |
| `OtherViews.jsx` | `CalendarView` (with workout detail drawer), `RacesView`, `SettingsView` (with AI model / API keys / Coach style / Rules). |
| `CommandPalette.jsx` | ⌘K palette — Navigate / Create / Coach / System. |

## What this kit is not

- **Not production code.** Components share a global window namespace (Babel-transpiled inline scripts). State is local; nothing persists.
- **Not real data.** Mira Lindqvist is a fixture. Numbers are plausible but invented.
- **Not exhaustive.** Side flows (login, athlete switching, onboarding, integrations management, individual race-day deep-dive) are explicitly out of scope until the user asks.

## Component coverage

Every preview card under `preview/comp-*.html` corresponds to live usage in this kit:

- `comp-buttons` → `<Button>` in 5 kinds × 3 sizes
- `comp-inputs` → search input + coach composer
- `comp-badges-pills` → `<Pill>` in zone & status variants, `<Kbd>` keys
- `comp-card-anatomy` → every `Card` follows this anatomy
- `comp-sidebar-nav` → `<Sidebar>`
- `comp-list-row` → `<WorkoutDetail>` conversation list, `<MemoryInbox>` rows
- `comp-readiness-card` → `<ReadinessRow>`
- `comp-ai-bubble` → `<CoachPanel>` AI message
