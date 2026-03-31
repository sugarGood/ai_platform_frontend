/** 与原型 `assets/js/app.js` 中能力与技能沙箱、编辑预填、SKILL.md 示意数据一致 */

export interface SkillTestFixture {
  inputLabel: string
  inputDefault: string
  metricsText: string
  traceText: string
  outputText: string
  ragHits?: string
}

export const SKILL_TEST_FIXTURES: {
  platform: Record<string, SkillTestFixture>
  agent: Record<string, SkillTestFixture>
} = {
  platform: {
    'sales-workflow': {
      inputLabel: '请求入参（JSON）',
      inputDefault: '{\n  "customer_id": "C-10882",\n  "quarter": "2025Q1",\n  "region": "华东"\n}',
      metricsText: '总耗时 2.84s · 编排 3 步 · Token 约 1,420（入 820 / 出 400）· request_id=sbx_req_7f2a',
      traceText:
        '[09:41:02.108] router.match → workflow:sales_insight (confidence 0.94)\n[09:41:02.220] step:1 tool.query_sales latency=240ms rows=12\n[09:41:01.102] step:2 rag.retrieve collection=sales_strategy top_k=4 hits=4\n[09:41:02.640] step:3 llm.generate model=claude-sonnet\n[09:41:02.890] runner.done status=ok',
      outputText:
        '## 销售洞察摘要（沙箱示例）\n• 华东区本季续约率 91%，环比 +3pp\n• 风险关注：C-10882 近 30 天工单密度高于分区 P75\n• 建议：优先安排客户经理回访，附带本季折扣策略说明（示例）',
      ragHits:
        '[#1 score 0.82] 《华东企业客户续约 playbook 2025Q1》第 3 节…\n[#2 score 0.76] sales_strategy / 行业包：制造业回款周期…',
    },
    'code-review': {
      inputLabel: '请求入参（JSON：diff + 策略）',
      inputDefault:
        '{\n  "repo": "checkout-service",\n  "pr": "1842",\n  "diff_excerpt": "@@ -12,3 +12,5 @@\\n+ String q = request.get(\\"id\\");\\n+ stmt.executeQuery(\\"SELECT * FROM orders WHERE id=\\"+q);",\n  "policy": "security_strict"\n}',
      metricsText: '总耗时 1.12s · 知识库片段 3 条 · Token 约 960 · model=claude-haiku',
      traceText:
        '[10:02:11.040] runner.start skill=code_review sandbox=true\n[10:02:11.090] rag.retrieve kb=代码规范 top_k=3\n[10:02:11.520] llm.generate template=cr_v3\n[10:02:12.080] policy.check OWASP_rules=pass',
      outputText:
        '## 审查结果（示例）\n1. [高] SQL 注入风险：`executeQuery` 拼接用户输入（diff 第 +2 行）\n2. [中] 缺少参数化查询 / ORM 绑定说明\n3. [低] 建议补充单元测试覆盖异常分支\n\n结论：不建议合入，需先修复注入点后复测。',
    },
    'expense-qa': {
      inputLabel: '请求入参（JSON）',
      inputDefault: '{\n  "question": "出差上海，住宿费每晚上限多少？",\n  "employee_level": "M3",\n  "top_k": 4\n}',
      metricsText: '总耗时 0.98s · retrieve 4 条 · rerank latency 40ms · Token 约 610',
      traceText:
        '[10:05:33.010] intent=policy_qa\n[10:05:33.080] rag.retrieve collection=finance_docs top_k=4\n[10:05:33.400] llm.generate citations=required',
      outputText:
        '根据《差旅管理办法（2024）》华东一线城市 M3 职级：住宿费上限 **¥650/晚**（含税另计），需通过钉钉差旅单事前审批。以下为引用依据摘要…（沙箱示例）',
      ragHits: '[#1] 《差旅管理办法》第四章 住宿标准表（M3/一线）…\n[#2] 附录 B：钉钉审批单必填字段说明…',
    },
    'crm-query': {
      inputLabel: '请求入参（JSON）',
      inputDefault:
        '{\n  "lookup": "by_phone",\n  "value": "+86-139****2188",\n  "fields": ["name", "tier", "last_order_at"]\n}',
      metricsText: '总耗时 186ms · tool=query_crm · 脱敏字段 2 个 · trace_id=crm_sbx_9c01',
      traceText:
        '[10:08:01.002] auth.tenant=acme scope=crm:read\n[10:08:01.088] tool.query_crm op=phone_lookup\n[10:08:01.186] mask.apply rules=phone,tier',
      outputText:
        '{\n  "name": "张**",\n  "tier": "GOLD",\n  "last_order_at": "2025-03-18T14:22:11Z",\n  "_redacted": ["phone", "email"]\n}',
    },
    'bug-analysis': {
      inputLabel: '请求入参（JSON）',
      inputDefault:
        '{\n  "sentry_event_id": "a9f3c21e",\n  "stack_top": "NullPointerException at com.acme.billing.InvoiceService.applyTax",\n  "release": "billing@2.14.0"\n}',
      metricsText: '总耗时 2.05s · tool=query_sentry hit=1 · kb=架构指南 2 段 · Token 约 1,280',
      traceText:
        '[10:11:44.010] runner.start\n[10:11:44.120] tool.query_sentry id=a9f3c21e\n[10:11:44.560] rag.retrieve 架构指南\n[10:11:46.020] llm.generate',
      outputText:
        '## 根因假设（Top 3）\n1. `applyTax` 对免税订单未做空判断（与 Sentry 首次 NPE 帧一致）\n2. v2.14.0 引入的新税率表在 staging 未覆盖边界用例\n3. 下游 currency 服务偶发超时导致部分字段未填充（概率较低）\n\n建议验证：在 InvoiceServiceTest 增加「免税 + 跨境」用例后复现。',
    },
    'security-scan': {
      inputLabel: '待扫描代码（JSON：snippet）',
      inputDefault:
        '{\n  "language": "java",\n  "snippet": "public void run(String u) { Runtime.getRuntime().exec(u); }"\n}',
      metricsText: '总耗时 0.74s · semgrep rules=owasp_custom_v12 matches=2 · llm_latency=310ms',
      traceText:
        '[10:14:20.010] semgrep_ci.start ruleset=owasp_custom_v12\n[10:14:20.210] match RCE pattern (line 1)\n[10:14:20.430] rag.retrieve 安全手册\n[10:14:20.740] llm.explain',
      outputText:
        '## 扫描摘要\n- **RCE（高危）**：`Runtime.exec` 直接消费外部入参 `u`，可执行任意命令。\n- **修复建议**：使用固定命令白名单 + ProcessBuilder + 参数拆分；禁止拼接 shell 字符串。\n- SARIF 报告已生成（示意）：`sbx_export/scan_a12f.sarif`',
    },
    'tech-review': {
      inputLabel: '方案上下文（JSON）',
      inputDefault:
        '{\n  "title": "订单中心读写分离",\n  "constraints": ["峰值 12k QPS", "RPO<5min"],\n  "options": ["Proxy 分片", "单元化 + 异地多活"]\n}',
      metricsText: '总耗时 4.2s · context_window≈28k tokens · model=claude-sonnet · structured_output=json_schema',
      traceText:
        '[10:17:01.010] runner.start skill=tech_design_review\n[10:17:01.400] rag.retrieve 架构指南 sections=4\n[10:17:05.180] llm.generate schema=review_table_v2',
      outputText:
        '{\n  "risks": [\n    {"item": "多活下订单唯一键冲突", "severity": "高", "mitigation": "全局序列 + 冲突补偿表" },\n    {"item": "读延迟与复制滞后", "severity": "中", "mitigation": "关键读走主库 + 限流" }\n  ],\n  "recommendation": "先落地 Proxy 分片验证峰值，再评估单元化（沙箱示例）",\n  "open_questions": ["跨区结算对账由谁主责？"]\n}',
    },
    'doc-gen': {
      inputLabel: '仓库与输出（JSON）',
      inputDefault:
        '{\n  "repo": "checkout-service",\n  "branch": "main",\n  "targets": ["openapi.yaml", "README.md"],\n  "style": "concise"\n}',
      metricsText: '总耗时 3.1s · ast.parse ok · Token 约 2,100 · codegen=openapi_v2',
      traceText:
        '[10:20:01.010] runner.start skill=doc_gen\n[10:20:01.400] repo.index paths=src/main/java\n[10:20:02.100] llm.generate openapi_from_code\n[10:20:03.050] export.write',
      outputText:
        '## OpenAPI 片段（沙箱）\n```yaml\nopenapi: 3.0.3\ninfo:\n  title: Checkout API\npaths:\n  /orders/{id}:\n    get:\n      summary: 查询订单\n```\nREADME 已生成「快速开始」与「本地运行」两节草案。',
    },
    'requirement-analysis': {
      inputLabel: '需求草稿（JSON）',
      inputDefault:
        '{\n  "idea": "会员积分支持跨店通兑",\n  "constraints": ["财务合规", "48h 到账"],\n  "personas": ["门店店长", "会员运营"]\n}',
      metricsText: '总耗时 2.6s · rag=产品规范 3 段 · Token 约 1,450',
      traceText:
        '[10:22:10.010] intent=prd_decompose\n[10:22:10.200] rag.retrieve 产品规范\n[10:22:11.800] llm.generate sections=goals,scope,acceptance',
      outputText:
        '### 用户故事（节选）\n- 作为店长，我希望在任意门店为会员办理积分抵扣，以便提升复购。\n\n### 验收标准（示例）\n1. 通兑前展示可抵扣上限与手续费说明\n2. 失败订单可回滚积分并留审计流水\n3. 报表 T+1 与财务对账文件字段一致',
      ragHits: '[#1] 《会员积分管理办法》3.2 跨店结算…\n[#2] 产品规范 / 支付与积分联动字段表…',
    },
    'gen-tests': {
      inputLabel: '被测上下文（JSON）',
      inputDefault:
        '{\n  "language": "java",\n  "framework": "junit5",\n  "class": "com.acme.billing.InvoiceService",\n  "focus": ["免税", "跨境税率"]\n}',
      metricsText: '总耗时 1.88s · sandbox=read_only · Token 约 1,020',
      traceText:
        '[10:25:00.010] runner.start skill=unit_test_gen\n[10:25:00.300] repo.rules load test-conventions.md\n[10:25:01.400] llm.generate test_skeleton',
      outputText:
        '```java\n@ExtendWith(MockitoExtension.class)\nclass InvoiceServiceTest {\n  @Test\n  void applyTax_exemptOrder_shouldNotThrow() { /* 草案 */ }\n  @Test\n  void applyTax_crossBorder_usesFxTable() { /* 草案 */ }\n}\n```\n（沙箱：未写入仓库）',
    },
  },
  agent: {
    'test-gen': {
      inputLabel: '仓库与测试约定（JSON）',
      inputDefault:
        '{\n  "language": "typescript",\n  "framework": "vitest",\n  "entry": "src/pay/Checkout.ts"\n}',
      metricsText: '总耗时 1.4s · dry_run=true · SKILL.md workflow 解析 ok',
      traceText:
        '[10:30:01.010] skill.load test-gen\n[10:30:01.200] workflow.steps validate\n[10:30:01.600] llm.generate skeleton_only',
      outputText: '已生成 Vitest describe/it 骨架与边界清单（空值 / 超时 / 下游失败），未执行被测代码（沙箱）。',
    },
    'deep-research': {
      inputLabel: '研究问题（JSON）',
      inputDefault: '{\n  "topic": "2026 年国内大模型 API 定价趋势",\n  "sources": ["arxiv", "官网", "内部 wiki"]\n}',
      metricsText: '总耗时 6.8s · MCP allowlist=firecrawl · citations=required',
      traceText:
        '[10:31:00.010] skill.load deep-research\n[10:31:02.000] retrieve.multi source=3\n[10:31:06.500] llm.generate report_sections',
      outputText: '## 摘要\n（沙箱）已按 GB/T 7714 占位列出可核对来源；正文含证据表与待核实项。',
    },
    'api-contract-check': {
      inputLabel: 'OpenAPI diff 入参（JSON）',
      inputDefault:
        '{\n  "base": "artifacts/openapi@1.8.0.yaml",\n  "head": "artifacts/openapi@1.9.0.yaml"\n}',
      metricsText: '总耗时 0.62s · diff nodes=paths,schemas · breaking=2',
      traceText:
        '[10:32:00.010] skill.load api-contract-check\n[10:32:00.200] openapi.diff structured\n[10:32:00.550] llm.summarize breaking[]',
      outputText:
        '### Breaking\n- `POST /orders` requestBody 新增必填字段 `currency`\n- 删除 `GET /legacy/ping`\n\n### Risky\n- `Order.status` enum 收窄为…（沙箱示例）',
    },
  },
}

export interface SkillEditPreset {
  name: string
  desc: string
  category: string
  invoke: string
}

export const SKILL_EDIT_PRESETS: {
  platform: Record<string, SkillEditPreset>
  agent: Record<string, SkillEditPreset>
} = {
  platform: {
    'code-review': {
      name: '代码审查',
      desc: '在合并前从规范、安全、性能三维度审查代码变更，并输出可操作的修改建议。',
      category: '工程',
      invoke: '/code-review',
    },
    'bug-analysis': {
      name: 'Bug 分析',
      desc: '结合日志、堆栈与架构知识库，归纳根因假设与验证路径。',
      category: '工程',
      invoke: '/bug-analysis',
    },
    'doc-gen': {
      name: '文档生成',
      desc: '从代码与注释生成 OpenAPI、README 等文档草案，供人工校对后合入。',
      category: '文档',
      invoke: '/doc-gen',
    },
    'requirement-analysis': {
      name: '需求分析',
      desc: '将一句话想法拆解为用户故事、范围边界与可验收标准清单。',
      category: '产品',
      invoke: '/requirement-analysis',
    },
    'security-scan': {
      name: '安全扫描',
      desc: '对提交片段与依赖做静态规则扫描，并对命中项给出修复建议。',
      category: '安全',
      invoke: '/security-scan',
    },
    'tech-review': {
      name: '技术方案评审',
      desc: '在架构约束下比较方案选项，输出风险、缓解措施与待澄清问题。',
      category: '工程',
      invoke: '/tech-review',
    },
    'gen-tests': {
      name: '单元测试生成',
      desc: '按仓库测试约定生成单测骨架与边界用例列表，不自动写库。',
      category: '测试',
      invoke: '/gen-tests',
    },
  },
  agent: {
    'test-gen': {
      name: '单元测试生成（Agent）',
      desc: '按项目栈生成单测骨架与边界用例，写入 SKILL.md 规程。',
      category: '测试',
      invoke: '/test-gen',
    },
    'deep-research': {
      name: '深度调研',
      desc: '多源检索 + 引用规范 + 固定章节报告结构。',
      category: '文档',
      invoke: '/deep-research',
    },
    'api-contract-check': {
      name: 'API 契约检查',
      desc: '对 OpenAPI 做结构化 diff，标记 breaking 与风险项。',
      category: '工程',
      invoke: '/api-contract-check',
    },
  },
}

export const AGENT_SKILL_MD: Record<string, string> = {
  'test-gen': `---
name: test-gen
description: 按项目栈生成单测骨架与边界用例
version: 0.2-draft
---

## When to activate
- 用户请求补充/生成单元测试
- 新模块合入前需要测试清单

## Workflow
1. 识别语言与测试框架（JUnit / pytest / vitest 等）
2. 为每个 public 方法生成 describe/it 骨架
3. 列出边界：空值、越界、并发、超时、下游失败
4. 输出可粘贴的测试文件草案（不自动写库）

## Guardrails
- 不执行被测代码；不访问生产密钥
- 若仓库无测试约定，先给出约定建议再生成骨架
`,
  'deep-research': `---
name: deep-research
description: 多源检索 + 引用规范 + 报告结构
version: 1.3
---

## When to activate
- 需要行业/论文/站内 wiki 综合调研
- 输出需带可核对引用

## Tools
- MCP: firecrawl（网页抓取，受 allowlist 约束）

## Workflow
1. 澄清研究问题与成功标准
2. 规划检索源与关键词（arxiv、官方文档、内部知识库）
3. 抓取 → 摘录 → 标注引用占位
4. 按固定章节输出：摘要 / 证据表 / 结论 / 待核实项

## Citation
- 使用 GB/T 7714 或 APA，二选一并在正文声明
- 禁止无来源的定量断言
`,
  'api-contract-check': `---
name: api-contract-check
description: OpenAPI diff + 破坏性变更提示
version: 1.0
---

## When to activate
- PR 修改了 openapi.yaml / swagger.json
- 发布前需要兼容性评审

## Workflow
1. 取 base 与 head 两份 OpenAPI（CI 传入路径或 artifact id）
2. 运行结构化 diff：paths / methods / schema / enums
3. 标记 breaking：必填新增、类型变窄、删除 endpoint、enum 删除值
4. 输出 Markdown 检查表供评审粘贴到 PR

## Output
- breaking[] / risky[] / safe[] 三类清单
- 每条附 YAML JSON Pointer 定位
`,
}

const CATEGORY_LABEL_TO_API: Record<string, string> = {
  工程: 'ENGINEERING',
  文档: 'DOCUMENTATION',
  测试: 'TESTING',
  安全: 'SECURITY',
  产品: 'PRODUCT',
  数据: 'DATA',
}

export function categoryLabelToApi(label: string): string {
  return CATEGORY_LABEL_TO_API[label] ?? 'ENGINEERING'
}
