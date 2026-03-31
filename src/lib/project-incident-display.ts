import type { ProjectIncidentResponse } from '../types/incident'
import type { ProjectIncidentCardModel } from '../types/module-page'

function isResolvedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return /^(RESOLVED|CLOSED|DONE|FIXED)$/i.test(status.trim())
}

export function pickPrimaryIncident(incidents: ProjectIncidentResponse[]): ProjectIncidentResponse | undefined {
  if (!incidents.length) return undefined
  const open = incidents.find((i) => !isResolvedStatus(i.status ?? undefined))
  return open ?? incidents[0]
}

export function incidentToCardModel(inc: ProjectIncidentResponse): ProjectIncidentCardModel {
  const sev = (inc.severity || '').toUpperCase()
  const isCritical =
    sev.includes('CRITICAL') || sev.includes('HIGH') || sev.includes('严重') || sev.includes('S1') || sev.includes('P0')

  let severityBadge = inc.severity?.trim() || '事故'
  if (isCritical) severityBadge = '🔴 严重'
  else if (sev.includes('MEDIUM') || sev.includes('中')) severityBadge = '🟠 中等'
  else if (sev.includes('LOW') || sev.includes('低')) severityBadge = '🟡 低'

  const statusLabel = inc.status?.trim() || '—'

  const stack = inc.errorStack?.trim() || inc.errorRequest?.trim() || '（后端未返回堆栈）'

  const pending =
    (inc.aiDiagnosisStatus || '').toUpperCase() === 'PENDING' ||
    (!(inc.aiDiagnosis || '').trim() && !isResolvedStatus(inc.status ?? undefined))

  const diag = inc.aiDiagnosis?.trim()
  let aiBlock: string
  if (diag) {
    aiBlock = diag
  } else if (pending) {
    aiBlock = 'AI 诊断尚未生成，可调用 POST …/ai-diagnose 触发分析。'
  } else {
    aiBlock = '暂无 AI 诊断。'
  }

  return {
    title: inc.title?.trim() || `事故 #${inc.id}`,
    severityBadge,
    severityIsDanger: isCritical,
    statusLabel,
    errorStack: stack,
    aiBlock,
    showIdeCta: Boolean(diag),
  }
}
