# Agent 0 - 契约基线总控任务

## 目标
产出前端与后端 OpenAPI 的联调差异清单，作为所有并行任务唯一事实源。

## 契约来源
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## 扫描范围
- `src/services/*.ts`
- `src/types/*.ts`

## 执行要求
1. 逐个 service 函数对照 OpenAPI：path/method/query/body/response。
2. 标记差异：字段名、分页结构、envelope 包装、nullability、枚举值。
3. 给出风险分级：
   - P0：会直接导致请求失败或主流程错误
   - P1：会导致展示错误或关键数据不完整
   - P2：轻微偏差或文档不一致
4. 生成每个业务域的“建议修改文件清单”。

## 输出格式
- 差异列表（按业务域）
- 每条包含：当前实现 / OpenAPI 定义 / 风险等级 / 建议改法
- 可并行项与冲突项说明

## 禁止事项
- 不修改业务逻辑
- 不猜测字段
- 不新增与联调无关重构
