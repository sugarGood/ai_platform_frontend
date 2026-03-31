---
name: vue-admin-feature-builder
description: Build or refactor Vue 3 + TypeScript admin features that follow a layered frontend structure such as `src/features`, `src/components`, `src/composables`, `src/services`, `src/types`, and Vitest tests. Use when adding or restructuring global/project pages, module workspaces, modal forms, dashboard blocks, router entries, or data-backed UI flows. Prefer this skill for structural feature work and page architecture, not trivial copy, style-only, or one-line bug fixes.
---

# Vue Admin Feature Builder

Build feature work that feels native to the existing repo instead of shipping isolated pages that bypass its routing, state, and test conventions.

Read [references/repo-patterns.md](references/repo-patterns.md) when you need a quick map from change type to file locations.

## Trigger Boundary

Use this skill when the request involves structural frontend work such as:

- Add a global page or project page.
- Add a module workspace, dashboard block, modal form, or composite detail view.
- Move logic out of a page into a composable or service.
- Wire new route metadata, page keys, or navigation behavior.
- Expand tests after a page-level refactor.

Do not use this skill for:

- Copy-only or style-only changes.
- Single selector fixes.
- Pure API contract updates with no meaningful page architecture change.

## Workflow

1. Inspect the repo before editing. Open the current router, adjacent feature pages, related composables, related services, and existing tests.
2. Classify the change. Decide whether it is:
   - Existing page update
   - New page route
   - Reusable UI block inside an existing page
   - Modal or overlay flow
   - Data-backed feature requiring service and state work
3. Choose the thinnest file surface that fits the request.
4. Implement from the bottom up: types, helpers, services, composables, then feature page and route.
5. Add or update the smallest test set that proves routing, rendering, and data flow still work.

## File Mapping Rules

### Page or route change

- Update router definitions first when the URL shape or page identity changes.
- Keep route metadata consistent with the surrounding pages.
- Match the existing naming pattern for `scope`, `pageKey`, and route names.

### Data-backed feature

- Put transport logic in `src/services`.
- Put derived state, caching, and page orchestration in `src/composables`.
- Put shape cleanup or display mapping in `src/lib` when multiple consumers may need it.
- Put request/response and view-model shapes in `src/types`.

### Pure presentation block

- Keep the page thin and move reusable markup into `src/components`.
- Reuse existing shell, overlay, and workspace components before introducing a new container.

### Modal or overlay flow

- Prefer the established overlay/composable pattern over local ad hoc state.
- Reuse existing form components and modal wiring when possible.

## Implementation Rules

- Prefer `Vue 3` with `<script setup lang="ts">`.
- Preserve the existing route hierarchy instead of introducing parallel navigation schemes.
- Keep feature pages declarative; push fetch logic and long transformations downward.
- Extend nearby patterns before inventing new abstractions.
- Name new files to match the surrounding directory convention.
- When a request spans both global and project scope, implement one scope cleanly first, then mirror only if the UX truly needs both.

## Minimum Test Matrix

Add the smallest relevant set from this list:

- Router test when routes, names, params, or meta change.
- Page render test when a feature page gains new conditional content.
- Composable or service test when state transitions or fetch orchestration change.
- Interaction test when a modal, action button, or navigation path changes.

## Anti-Patterns

- Do not fetch directly in random components when the repo already centralizes requests in services or composables.
- Do not duplicate route metadata or page key logic across unrelated files.
- Do not bury normalization logic inside templates.
- Do not add a reusable component when a one-off local section is clearer.
- Do not skip tests after changing routing, overlays, or page composition.
