/** 将表单「数值 + K/M Token/月」解析为后端 `monthlyTokenQuota`（按 Token 个数）。空串表示不传，走后端默认。 */
export function parseMonthlyTokenQuotaForApi(quantity: string, unit: string): number | undefined {
  const raw = String(quantity ?? '')
    .trim()
    .replace(/,/g, '')
  if (raw === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  if (n === 0) return 0
  const u = (unit || '').trim()
  if (u.startsWith('M')) return Math.floor(n * 1_000_000)
  return Math.floor(n * 1000)
}
