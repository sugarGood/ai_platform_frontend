# Contract Sources

Use this reference when the contract source is unclear or when you need a quick sweep of affected frontend layers.

## Preferred source order

1. Local `_api_docs.json` or another checked-in generated spec
2. Explicit Swagger or OpenAPI endpoint
3. Backend code for controllers, DTOs, serializers, or validation schemas
4. Existing frontend services and types
5. Sample payloads or field notes from the user

## Touchpoint map

- Request helper: auth, envelope, timeout, query-string, 204 handling
- Service: path, method, params, body, response unwrap
- Types: response objects, request payloads, enums, nullable fields
- Normalizers: pagination, nested `data/content/items/list` handling, display labels
- Composables: caching, derived labels, workflow state, optimistic updates
- Pages and components: only the fields they render or submit
- Tests: fixtures, fetch mocks, router cases if API changes navigation behavior

## Escalate uncertainty

- Stop and report when only examples exist and the contract is still ambiguous.
- Prefer analysis mode when multiple backend sources disagree.
- Preserve existing behavior when the new contract is incomplete, then mark the exact missing fields.
