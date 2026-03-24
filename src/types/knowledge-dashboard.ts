/**
 * 知识库管理页顶部四块统计，由看板接口返回体归一化得到。
 * 后端可把指标放在根对象或 knowledge / kb / rag 等嵌套下。
 */
export interface KnowledgeWorkspaceDashboardStats {
  globalDocTotal: number | null
  monthlySearchCount: number | null
  /** `monthlySearches.countLastMonth`，用于环比文案 */
  searchCountLastMonth: number | null
  /** `monthlySearches.monthOverMonthPercent`，有则优先展示「较上月」 */
  searchMonthOverMonthPercent: number | null
  knowledgeHitRatePercent: number | null
  /** `hitRate.targetPercent`，默认 UI 用 70 */
  hitRateTargetPercent: number | null
  /** `hitRate.meetsTarget` */
  hitRateMeetsTarget: boolean | null
  vectorQueueCount: number | null
  /** 副标题「↑ N 本月新建库」 */
  newKnowledgeBasesThisMonth: number | null
  /** 文档「↑ N 本月新增」 */
  newDocumentsThisMonth: number | null
}
