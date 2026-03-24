import type { KnowledgeWorkspaceDashboardStats } from '../types/knowledge-dashboard'

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return null
}

function numFromUnknown(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(String(v).replace(/,/g, '').replace(/%/g, '').trim())
    if (Number.isFinite(n)) return n
  }
  return null
}

/** 0.8 → 80（命中率等） */
function toPercentInt(n: number): number {
  if (n >= 0 && n <= 1) return Math.round(n * 100)
  return Math.round(Math.min(100, Math.max(0, n)))
}

function deepNum(root: Record<string, unknown>, paths: string[][]): number | null {
  for (const parts of paths) {
    let cur: unknown = root
    for (const p of parts) {
      const o = asRecord(cur)
      if (!o) {
        cur = undefined
        break
      }
      cur = o[p]
    }
    const n = numFromUnknown(cur)
    if (n != null) return n
  }
  return null
}

function deepPercent(root: Record<string, unknown>, paths: string[][]): number | null {
  for (const parts of paths) {
    let cur: unknown = root
    for (const p of parts) {
      const o = asRecord(cur)
      if (!o) {
        cur = undefined
        break
      }
      cur = o[p]
    }
    const n = numFromUnknown(cur)
    if (n != null) return toPercentInt(n)
  }
  return null
}

function firstPick(layers: Record<string, unknown>[], paths: string[][]): number | null {
  for (const layer of layers) {
    const n = deepNum(layer, paths)
    if (n != null) return n
  }
  return null
}

function firstPickPercent(layers: Record<string, unknown>[], paths: string[][]): number | null {
  for (const layer of layers) {
    const n = deepPercent(layer, paths)
    if (n != null) return n
  }
  return null
}

function firstPickBool(layers: Record<string, unknown>[], paths: string[][]): boolean | null {
  for (const layer of layers) {
    for (const parts of paths) {
      let cur: unknown = layer
      for (const p of parts) {
        const o = asRecord(cur)
        if (!o) {
          cur = undefined
          break
        }
        cur = o[p]
      }
      if (typeof cur === 'boolean') return cur
    }
  }
  return null
}

/** 环比等可正可负的百分数：后端可能给 18 或 0.18 */
function firstPickSignedPercent(layers: Record<string, unknown>[], paths: string[][]): number | null {
  for (const layer of layers) {
    for (const parts of paths) {
      let cur: unknown = layer
      for (const p of parts) {
        const o = asRecord(cur)
        if (!o) {
          cur = undefined
          break
        }
        cur = o[p]
      }
      const n = numFromUnknown(cur)
      if (n == null) continue
      if (n >= -1 && n <= 1) return Math.round(n * 1000) / 10
      return Math.round(n * 10) / 10
    }
  }
  return null
}

/** 常见 Result / R 包装：`{ data: {} }`、`{ code, data }`、单层 `data` */
function unwrapSeed(raw: unknown): unknown {
  let cur: unknown = raw
  for (let i = 0; i < 8; i++) {
    const o = asRecord(cur)
    if (!o) break
    const keys = Object.keys(o)
    if (keys.length === 1) {
      const only = keys[0]!
      if (['data', 'result', 'payload', 'content', 'body'].includes(only)) {
        cur = o[only]
        continue
      }
    }
    if (o.data != null && (typeof o.code === 'number' || typeof o.success === 'boolean')) {
      cur = o.data
      continue
    }
    break
  }
  return cur
}

function scoreLayer(o: Record<string, unknown>): number {
  const blob = Object.keys(o)
    .join(' ')
    .toLowerCase()
  let s = 0
  if (/(knowledge|document|kb|rag|vector|embed|chunk|检索|知识)/.test(blob)) s += 4
  if (/(search|query|retriev|命中)/.test(blob)) s += 2
  if (/(hit|rate|queue|pending)/.test(blob)) s += 1
  return s
}

/** BFS 收集响应树内所有纯对象，避免字段落在深层嵌套里取不到 */
function gatherObjectLayers(seed: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const seen = new Set<object>()
  const queue: unknown[] = [seed]
  let guard = 0
  while (queue.length > 0 && guard < 500) {
    guard++
    const cur = queue.shift()
    const o = asRecord(cur)
    if (!o || seen.has(o)) continue
    seen.add(o)
    out.push(o)
    for (const v of Object.values(o)) {
      if (v instanceof Date) continue
      if (Array.isArray(v)) {
        for (const el of v.slice(0, 120)) {
          const eo = asRecord(el)
          if (eo && !seen.has(eo)) queue.push(eo)
        }
      } else {
        const co = asRecord(v)
        if (co && !seen.has(co)) queue.push(co)
      }
    }
  }
  return out
}

function buildMetricLayers(raw: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapSeed(raw)
  let layers: Record<string, unknown>[] = []

  if (Array.isArray(unwrapped)) {
    const seen = new Set<object>()
    for (const el of unwrapped.slice(0, 40)) {
      for (const L of gatherObjectLayers(el)) {
        if (!seen.has(L)) {
          seen.add(L)
          layers.push(L)
        }
      }
    }
  } else {
    layers = gatherObjectLayers(unwrapped)
  }

  layers.sort((a, b) => scoreLayer(b) - scoreLayer(a))
  return layers
}

/** 从平台看板 JSON 中解析知识库管理页四块统计 */
export function normalizeKnowledgeWorkspaceDashboard(raw: unknown): KnowledgeWorkspaceDashboardStats {
  const layers = buildMetricLayers(raw)

  return {
    globalDocTotal: firstPick(layers, [
      ['globalDocuments', 'total'],
      ['global_documents', 'total'],
      ['globalDocumentCount'],
      ['global_doc_count'],
      ['totalGlobalDocuments'],
      ['total_global_documents'],
      ['globalDocumentsTotal'],
      ['global_documents_total'],
      ['globalDocTotal'],
      ['global_doc_total'],
      ['totalDocuments'],
      ['total_documents'],
      ['totalDocumentCount'],
      ['total_doc_count'],
      ['knowledgeDocumentCount'],
      ['knowledge_document_count'],
      ['kbDocumentTotal'],
      ['kb_document_total'],
      ['documentTotal'],
      ['document_count'],
      ['docTotal'],
      ['doc_total'],
    ]),
    monthlySearchCount: firstPick(layers, [
      ['monthlySearches', 'countThisMonth'],
      ['monthly_searches', 'count_this_month'],
      ['monthlySearchCount'],
      ['monthly_search_count'],
      ['monthly_searches'],
      ['searchesThisMonth'],
      ['searches_this_month'],
      ['searchCountMonthly'],
      ['search_count_monthly'],
      ['monthlyRetrievalCount'],
      ['monthly_retrieval_count'],
      ['monthSearchCount'],
      ['month_search_count'],
      ['kbMonthlySearchCount'],
      ['kb_monthly_search_count'],
      ['searchCountThisMonth'],
      ['search_count_this_month'],
      ['knowledgeSearchCountThisMonth'],
      ['knowledge_search_count_this_month'],
      ['monthlyQueryCount'],
      ['monthly_query_count'],
      ['retrievalCountThisMonth'],
      ['retrieval_count_this_month'],
      ['queryCountMonthly'],
      ['query_count_monthly'],
      ['totalSearchThisMonth'],
      ['total_search_this_month'],
      ['searchTimesThisMonth'],
      ['search_times_this_month'],
    ]),
    searchCountLastMonth: firstPick(layers, [
      ['monthlySearches', 'countLastMonth'],
      ['monthly_searches', 'count_last_month'],
    ]),
    searchMonthOverMonthPercent: firstPickSignedPercent(layers, [
      ['monthlySearches', 'monthOverMonthPercent'],
      ['monthly_searches', 'month_over_month_percent'],
    ]),
    knowledgeHitRatePercent: firstPickPercent(layers, [
      ['hitRate', 'percent'],
      ['hit_rate', 'percent'],
      ['knowledgeHitRate'],
      ['knowledge_hit_rate'],
      ['kbHitRate'],
      ['kb_hit_rate'],
      ['ragHitRate'],
      ['rag_hit_rate'],
      ['knowledgeBaseHitRate'],
      ['knowledge_base_hit_rate'],
      ['kbRagHitRate'],
      ['hitRate'],
      ['hit_rate'],
    ]),
    hitRateTargetPercent: firstPick(layers, [
      ['hitRate', 'targetPercent'],
      ['hit_rate', 'target_percent'],
    ]),
    hitRateMeetsTarget: firstPickBool(layers, [
      ['hitRate', 'meetsTarget'],
      ['hit_rate', 'meets_target'],
    ]),
    vectorQueueCount: firstPick(layers, [
      ['vectorizationQueue', 'processingCount'],
      ['vectorization_queue', 'processing_count'],
      ['vectorizationQueue'],
      ['vectorQueue'],
      ['vector_queue'],
      ['embeddingQueue'],
      ['embedding_queue'],
      ['embedding_queue_size'],
      ['pendingVectorization'],
      ['pending_vectorization'],
      ['kbVectorQueue'],
      ['kb_vector_queue'],
      ['vectorPendingCount'],
      ['vector_pending_count'],
    ]),
    newKnowledgeBasesThisMonth: firstPick(layers, [
      ['newKnowledgeBasesThisMonth'],
      ['new_knowledge_bases_this_month'],
      ['kbCreatedThisMonth'],
      ['kb_created_this_month'],
      ['newKbThisMonth'],
      ['new_kb_this_month'],
      ['monthlyNewKnowledgeBases'],
      ['monthly_new_knowledge_bases'],
    ]),
    newDocumentsThisMonth: firstPick(layers, [
      ['globalDocuments', 'newThisMonth'],
      ['global_documents', 'new_this_month'],
      ['newDocumentsThisMonth'],
      ['new_documents_this_month'],
      ['documentsAddedThisMonth'],
      ['documents_added_this_month'],
      ['monthlyNewDocuments'],
      ['monthly_new_documents'],
      ['docIngestThisMonth'],
      ['doc_ingest_this_month'],
      ['newInboundDocuments'],
      ['new_inbound_documents'],
    ]),
  }
}
