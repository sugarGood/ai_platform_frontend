# 并行联调 Agent 提示词（4-Agent 版）

> 基线来源：`docs/agent-tasks/agent-0-contract-baseline.md`
> 
> 要求：所有 Agent 仅按基线执行，不猜测字段，不做联调无关重构。

---

## Agent-A（P0 核心通路）

```text
你是 Agent-A，负责 P0 契约修复（必须优先完成）。

目标：
修复会导致请求失败/主流程错误的接口差异。

范围（仅可改）：
- src/services/me-usage.ts
- src/services/project-token-dashboard.ts
- src/services/knowledge.ts（仅处理 createKbDocument 路径风险，不做大改）

必须完成：
1) /api/me/usage 与 /api/me/usage/events：补必填 userId query。
2) /api/projects/{projectId}/token-dashboard/members/batch-settle：
   请求体字段改为 resetMemberAiQuotaUsed / resetPersonalCredentialUsed。
3) knowledge 文档创建路径风险收敛：
   当前 createKbDocument 与 OpenAPI不一致（疑似无 POST /documents）。
   做最小安全处理，避免默认404风险（可标记废弃/收敛到 upload 流程，但不要改大业务）。

限制：
- 不新增功能，不重构页面。
- 不猜后端字段。

输出：
- 变更文件清单
- 每项“问题 -> 修复 -> 风险”
- 待后端确认项
```

---

## Agent-B（Projects + Users 契约对齐）

```text
你是 Agent-B，负责 Projects/Users 域契约对齐（P1主力）。

范围（仅可改）：
- src/services/projects.ts
- src/types/project.ts
- src/services/users.ts
- 必要时 src/composables/useProjects.ts（仅参数透传）

必须完成：
1) 项目字段命名对齐：
   perRequestTokenLimit -> singleRequestTokenCap（与OpenAPI一致，必要时做内部映射兼容）。
2) listProjects 支持并透传：
   keyword/status/projectType（保留 page/size）。
3) getProjectsDashboard 支持并透传：
   page/size/includeArchived/keyword/status/projectType。
4) users 查询参数冲突（OpenAPI query-object vs 前端扁平）：
   采用“可运行优先 + 可切换结构”方案，不做激进切换。
   在 service 层集中处理并写清楚注释。

限制：
- 不改页面视觉和流程。
- 不做无依据协议迁移。

输出：
- 变更文件清单
- 参数/字段对齐矩阵
- 兼容与待确认说明
```

---

## Agent-C（Knowledge + Credentials 契约收敛）

```text
你是 Agent-C，负责 Knowledge/Credentials 契约收敛（P1+P2）。

范围（仅可改）：
- src/services/knowledge.ts
- src/types/knowledge.ts
- src/services/platform-credentials.ts
- src/types/credentials.ts

必须完成：
1) /projects/{projectId}/knowledge-configs POST：
   整理为明确 DTO 输入（EnableProjectKnowledgeConfigRequest），
   保留当前可运行序列化方式，并标记 OpenAPI 参数位置冲突点（query object vs 当前实现）。
2) /knowledge-bases/{kbId}/rag-config PUT：
   将请求体从 Record<string,string> 收敛到明确类型（embeddingModel/injectMode）。
3) createPlatformCredential：
   去除/弱化创建时 boundProjectId 依赖，绑定走 /credentials/{id}/bound-project。
4) rotatePlatformCredential：
   支持可选 gracePeriodHours（不破坏现有调用）。

限制：
- 不改页面业务。
- 不猜测后端未文档字段。

输出：
- 变更文件清单
- DTO/请求体前后对比
- 仍需后端确认项
```

---

## Agent-D（低风险清理 + 总体验收）

```text
你是 Agent-D，负责低风险清理与最终验收收口（P2 + 汇总）。

范围（仅可改）：
- src/services/project-token-dashboard.ts
- src/services/usage-events.ts
- src/types/*.ts（仅必要一致性修补）
- docs/agent-tasks/agent-0-contract-baseline.md（回填结果）

必须完成：
1) sync-quotas 去掉无意义 body。
2) ai-access 仅发送 enabled（移除 aiEnabled）。
3) usage-events 补透传：
   sourceType/status/occurredAfter/occurredBefore。
4) 类型一致性巡检（仅确定项）：
   - nullability/命名残留/明确枚举注释，避免猜测性改动。
5) 汇总 A/B/C 结果，回填联调基线文档：
   - 已修复项
   - 保留待确认项
   - P0/P1/P2 最新状态

限制：
- 不做功能扩展，不做大重构。

输出：
- 最终联调差异表（更新版）
- P0是否清零
- 阻塞项列表（需后端确认）
```

---

## 并行顺序建议

1. 先并行：Agent-A、Agent-B、Agent-C
2. 后执行：Agent-D（拿到 A/B/C 结果后统一收口）
