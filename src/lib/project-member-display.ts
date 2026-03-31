import type { TableCell } from '../types/module-page'
import type { BackendProjectMemberResponse } from '../types/project'

/** ISO date-time → YYYY-MM-DD，空则 — */
export function formatMemberDateDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = String(iso)
  return d.length >= 10 ? d.slice(0, 10) : d
}

type MemberCredFields = Pick<
  BackendProjectMemberResponse,
  'credentialStatus' | 'credentialExpiresInDays' | 'credentialExpiresAt'
>

/**
 * 凭证状态与过期信息合一列（OpenAPI：credentialStatus + credentialExpiresInDays / credentialExpiresAt）。
 * EXPIRING_SOON 且有剩余天数 →「N天后过期」；VALID 可带「· 剩余N天」或「· 至 YYYY-MM-DD」。
 */
export function memberCredentialStatusCell(m: MemberCredFields): Pick<TableCell, 'text' | 'tone' | 'display'> {
  const code = m.credentialStatus
  if (code == null || String(code).trim() === '') {
    return { text: '—', tone: 'muted' }
  }
  const c = String(code).toUpperCase().trim()
  const days = m.credentialExpiresInDays
  const at = formatMemberDateDay(m.credentialExpiresAt ?? null)

  if (c === 'EXPIRING_SOON') {
    if (days != null && days >= 0) {
      return { text: `${days}天后过期`, tone: 'warning', display: 'tag' }
    }
    return { text: '即将过期', tone: 'warning', display: 'tag' }
  }

  if (c === 'VALID') {
    let extra = ''
    if (days != null && days >= 0) {
      extra = ` · 剩余${days}天`
    } else if (at !== '—') {
      extra = ` · 至 ${at}`
    }
    return { text: `有效${extra}`, tone: 'success', display: 'tag' }
  }

  const map: Record<string, Pick<TableCell, 'text' | 'tone' | 'display'>> = {
    NONE: { text: '未创建', tone: 'muted', display: 'tag' },
    EXPIRED: { text: '已过期', tone: 'danger', display: 'tag' },
    REVOKED: { text: '已吊销', tone: 'danger', display: 'tag' },
    DISABLED: { text: '已停用', tone: 'muted', display: 'tag' },
  }
  return map[c] ?? { text: code, tone: 'muted', display: 'tag' }
}
