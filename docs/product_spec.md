# Fragment Isles Product Spec

## Product Name

Fragment Isles

## Product Positioning

Fragment Isles is a lightweight desktop fragment workspace for AI researchers. It helps users quickly capture fragmented information, use AI to generate editable categories, tags, summaries, and time reminders, and manually trigger relation analysis, research material organization, and Markdown export when needed. It also exposes API usage and cost so model calls remain visible and controlled.

## Product Goals

- Reduce information anxiety from scattered research fragments.
- Reduce time anxiety around deadlines, meetings, and reminders.
- Reduce usage anxiety by making AI costs explicit and user-controlled.
- Keep the app lightweight, local-first, and suitable for long-running desktop use.

## Full Product Scope

1. Fragment capture for text, images, Markdown, code snippets, and research notes.
2. AI-assisted but user-editable category system.
3. AI-assisted and user-editable tag system.
4. Time information detection and reminder suggestions.
5. Timeline Inbox for all time-related fragments and reminders.
6. User-triggered fragment relation analysis.
7. Similar fragment detection as part of relation analysis, not as a separate background feature.
8. On-demand research summaries and Markdown summaries, without automatic weekly reports.
9. Markdown as the only export format.
10. API provider settings plus API usage and cost tracking.
11. Future optional integrations: webpage import, Zotero / BibTeX import, OCR / VLM image understanding, and calendar export.

## Non-Negotiable Product Principles

1. Keep implementation aligned with the current full product scope.
2. Implement the product in phases.
3. If a feature is part of the current scope but not implemented yet, keep its entry point, placeholder, or TODO instead of removing it.
4. No cloud sync.
5. No complex backend.
6. No automatic AI calls in the background.
7. Every AI call must be explicitly triggered by the user.
8. Every potentially costly AI action must show a confirmation dialog before execution.
9. Every export must be Markdown.
10. Data should be stored locally first.

## Product Architecture Direction

- Desktop-first, local-first application.
- Lightweight data layer using local storage primitives.
- No dependency on hosted backend services for core workflows.
- AI features should be framed as explicit tools, not invisible automation.

## Delivery Strategy

Fragment Isles should be built in phases rather than as a single big release.

### Phase rule

- Current-phase tasks should be implemented cleanly.
- Future-scope modules should remain visible in navigation or as placeholders when appropriate.
- Unimplemented features may expose disabled actions, placeholder screens, or TODO markers, but should not disappear from the product structure.

## Recommended Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Lucide React
- Dexie.js / IndexedDB
- Tauri for later desktop packaging

## Platform Target

- Windows
- macOS

## Source Notes

This spec consolidates the current design intent from:

- `docs/Fragment Isles 功能设计稿 v0.2.md`
- `docs/产品细节.md`
