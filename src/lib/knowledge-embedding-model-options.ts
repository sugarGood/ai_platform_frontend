/** 知识库 embeddingModel 字段：当前平台可用向量模型（与表单下拉一致） */
export const KNOWLEDGE_EMBEDDING_MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'bge-m3', label: 'bge-m3' },
]

export const KNOWLEDGE_EMBEDDING_MODEL_VALUES = KNOWLEDGE_EMBEDDING_MODEL_OPTIONS.map((o) => o.value)
