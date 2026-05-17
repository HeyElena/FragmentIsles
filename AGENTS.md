# AGENTS

## Required Reading

Before starting any development task, read:

1. `docs/product_spec.md`
2. `docs/design_direction.md`

## Working Rules

1. Keep the current product scope aligned with `docs/product_spec.md`.
2. Do not introduce complex dependencies unless explicitly required.
3. Do not automatically call AI.
4. All AI features should default to a confirmation dialog before execution.
5. Only complete the current task; do not proactively implement later modules.
6. The UI must preserve Fragment Isles's artistic, lightweight, soft visual direction.
7. All exports must be Markdown.

## Product Constraints

1. Keep the app local-first.
2. Do not add cloud sync unless explicitly requested in a future scope change.
3. Do not add a complex backend.
4. Remove obsolete modules cleanly from both UI and local data model when the product scope changes.

## Implementation Bias

- Prefer simple architecture over premature abstraction.
- Preserve room for phased implementation.
- Treat AI as an explicit user tool, not hidden automation.
