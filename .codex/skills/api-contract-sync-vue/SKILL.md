---
name: api-contract-sync-vue
description: Analyze or implement backend API contract changes in Vue 3 + TypeScript frontends that use shared request helpers, typed services, composables, normalization utilities, and Vitest fetch mocks. Use when syncing Swagger or OpenAPI docs, local `_api_docs.json`, backend DTO/controller changes, or sample payloads into frontend `types`, `services`, `composables`, pages, and tests. Prefer this skill for interface drift and integration work, not purely visual UI edits.
---

# API Contract Sync Vue

Sync frontend code to a real contract source before editing, then update only the files required to keep transport, typing, state, and tests aligned.

Read [references/contract-sources.md](references/contract-sources.md) when you need the source priority order or touchpoint checklist.

## Modes

Operate in one of two modes:

- Analysis mode: map the contract source, list affected files, call out uncertainty, and stop before broad edits.
- Apply mode: implement the agreed changes across types, services, state, pages, and tests.

Default to analysis mode when the contract is incomplete, conflicting, or only partially documented.

## Contract Source Priority

Read sources in this order and stop once the contract is trustworthy:

1. Local generated docs such as `_api_docs.json`.
2. Explicit Swagger or OpenAPI URL.
3. Backend controller, DTO, schema, or serializer code.
4. Existing frontend service and type definitions.
5. User-provided payload samples or field lists.

If higher-priority sources disagree with lower-priority ones, trust the higher-priority source and note the drift.

## Non-Negotiable Rules

- Do not invent fields, enum values, pagination shapes, or envelope wrappers.
- Do not widen types just to silence uncertainty.
- Do not bypass existing request helpers unless the repo already has an intentional exception.
- Do not hide contract mismatches inside components; surface them in types, normalizers, or service boundaries.

## Workflow

1. Gather the contract source and note what is confirmed versus inferred.
2. Find the frontend touchpoints:
   - request helper usage
   - service functions
   - related composables
   - normalization helpers
   - page consumers
   - tests and mocks
3. Decide the minimum edit surface.
4. Update transport first, then shapes, then derived state, then UI consumers.
5. Adjust tests to prove the new contract and to catch drift later.

## Implementation Rules

- Prefer the repo's shared request helpers for JSON, empty-body, auth, and query-string behavior.
- Keep endpoint details in `src/services`.
- Put reusable shape cleanup in `src/lib` or the nearest normalization helper.
- Update `src/types` when the contract changes names, nullability, nesting, or enums.
- Update composables when caching, derived labels, or page orchestration depend on the changed fields.
- Touch pages only after lower layers reflect the contract.

## Testing Checklist

Add the smallest useful coverage from this list:

- Service test or fetch mock update when request paths, params, methods, or response shapes change.
- Composable test when derived state or orchestration changes.
- Page test when visible UI depends on changed fields.
- Router test only if API-driven routing behavior changes.

## Drift Checklist

Before finishing, verify:

- query keys and path params still match the backend contract
- `null` versus empty string assumptions are still correct
- page and list response helpers still match the payload shape
- error handling still produces useful messages
- mocks and fixtures reflect the real contract

## Anti-Patterns

- Do not parse raw backend payloads directly in templates.
- Do not leave stale fields in types after the service stops returning them.
- Do not mix documented and guessed response shapes in the same patch.
- Do not update UI copy to mask an underlying contract mismatch.
