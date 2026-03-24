/** 知识库 category 字段：产品约定枚举（与表单下拉一致） */
export const KNOWLEDGE_CATEGORY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '技术规范', label: '技术规范' },
  { value: '产品文档', label: '产品文档' },
  { value: '安全合规', label: '安全合规' },
  { value: '架构设计', label: '架构设计' },
  { value: 'API 与集成', label: 'API 与集成' },
  { value: '运维手册', label: '运维手册' },
  { value: '业务制度', label: '业务制度' },
  { value: '培训指引', label: '培训指引' },
  { value: '发布与变更', label: '发布与变更' },
  { value: '数据治理', label: '数据治理' },
  { value: '测试与质量', label: '测试与质量' },
  { value: '设计规范', label: '设计规范' },
  { value: '常见问题', label: '常见问题' },
]

export const KNOWLEDGE_CATEGORY_VALUES = KNOWLEDGE_CATEGORY_OPTIONS.map((o) => o.value)
