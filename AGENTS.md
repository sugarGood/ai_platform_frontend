## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. This project keeps its project-specific skills inside `.codex/skills` so they apply to this repo's architecture and conventions.

### Available skills
- vue-admin-feature-builder: Build or refactor Vue 3 + TypeScript admin features that follow this repo's layered structure, routing, composables, services, and Vitest patterns. Use for new pages, module workspaces, modal flows, route wiring, or structural page refactors. (file: .codex/skills/vue-admin-feature-builder/SKILL.md)
- api-contract-sync-vue: Analyze or implement backend API contract changes using this repo's shared request helpers, typed services, normalization utilities, and test patterns. Use for Swagger/OpenAPI sync, `_api_docs.json`, DTO drift, or response-shape updates. (file: .codex/skills/api-contract-sync-vue/SKILL.md)

### How to use skills
- Trigger a skill when the user names it explicitly or the task clearly matches its description.
- Prefer these project-local skills over generic approaches when working in this repository.
- Read only enough of a skill to follow its workflow.
- Resolve relative paths inside a skill from that skill's own directory first.
- Load reference files only when they are needed for the current task.
- If a skill cannot be applied cleanly, explain the issue briefly and continue with the best local fallback.
