# Repo Patterns

Use this reference only when you need a quick reminder of where to place code.

## Common file targets

- New top-level page: `src/features/**`, `src/router/index.ts`, and one page-focused test.
- Project-scoped page: existing `project` feature directory plus route metadata and route tests.
- Shared UI block: `src/components/**` and the nearest consuming page.
- Cross-page state or orchestration: `src/composables/**`.
- Backend transport and query assembly: `src/services/**`.
- Shape normalization or display formatting: `src/lib/**`.
- View-model or API types: `src/types/**`.

## Good defaults

- Prefer extending an adjacent feature file over creating a brand-new pattern.
- Prefer one composable with clear responsibilities over scattering refs across multiple pages.
- Prefer route-level tests for navigation shape and page-level tests for visible behavior.

## Smells

- Page file contains fetch code, retry logic, and response parsing.
- New route exists without metadata matching nearby routes.
- Feature work introduces duplicate table, modal, or shell wrappers that already exist nearby.
