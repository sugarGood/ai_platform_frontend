import { ref } from 'vue'

import type {
  ActivityEvent,
  DashboardMetric,
  DepartmentUsage,
  Incident,
  TokenTrendPoint,
} from '../types/dashboard'
import type { UserResponse } from '../types/user'
import { listDepartments } from '../services/departments'
import { listProjects } from '../services/projects'
import { listUsageEvents } from '../services/usage-events'
import { listUsers } from '../services/users'

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

function toLocalDateKey(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatDayLabel(dateKey: string): string {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  return `${parts[1]}/${parts[2]}`
}

function formatRelativeZh(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 16).replace('T', ' ')
  const diffMs = Date.now() - t
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  return iso.length >= 10 ? iso.slice(0, 10) : iso
}

function userLabel(users: UserResponse[], userId: number | null | undefined) {
  if (userId == null) return '未知用户'
  const u = users.find((x) => x.id === userId)
  return (u?.fullName?.trim() || u?.username || `用户 #${userId}`) as string
}

const emptyMetrics: DashboardMetric[] = [
  { id: 'token-usage', icon: '🤖', label: '用量 Token 汇总', value: '0', delta: '暂无用量事件', tone: 'primary' },
  { id: 'platform-users', icon: '👥', label: '平台用户', value: '0', delta: 'GET /api/users' },
  { id: 'active-projects', icon: '📁', label: '活跃项目', value: '0', delta: 'GET /api/projects' },
  { id: 'failed-calls', icon: '🚨', label: '非成功调用（本页）', value: '0', delta: '来自 usage-events', tone: 'default' },
]

export function useDashboard() {
  const loading = ref(false)
  const error = ref('')

  const metrics = ref<DashboardMetric[]>([...emptyMetrics])
  const tokenTrend = ref<TokenTrendPoint[]>([])
  const departmentUsage = ref<DepartmentUsage[]>([])
  const incidents = ref<Incident[]>([])
  const activities = ref<ActivityEvent[]>([])

  async function loadDashboard() {
    loading.value = true
    error.value = ''

    try {
      const [projPage, users, usagePage, depts] = await Promise.all([
        listProjects(1, 500),
        listUsers(),
        listUsageEvents({ page: 1, size: 500 }),
        listDepartments(),
      ])

      const events = usagePage.data ?? []
      const totalTok = events.reduce((a, e) => a + (Number(e.totalTokens) || 0), 0)
      const failEvents = events.filter((e) => (e.status || '').toUpperCase() !== 'SUCCESS')
      const activeProjects = projPage.data.filter((p) => (p.status || '').toUpperCase() === 'ACTIVE').length

      const usageNote =
        usagePage.total > events.length
          ? `本页 ${events.length} 条，共 ${usagePage.total} 条`
          : `共 ${events.length} 条用量事件`

      metrics.value = [
        {
          id: 'token-usage',
          icon: '🤖',
          label: '用量 Token 汇总',
          value: formatTokensShort(totalTok),
          delta: usageNote,
          tone: 'primary',
        },
        {
          id: 'platform-users',
          icon: '👥',
          label: '平台用户',
          value: String(users.length),
          delta: 'GET /api/users',
        },
        {
          id: 'active-projects',
          icon: '📁',
          label: '活跃项目',
          value: String(activeProjects),
          delta: `共 ${projPage.total} 个项目`,
        },
        {
          id: 'failed-calls',
          icon: '🚨',
          label: '非成功调用（本页）',
          value: String(failEvents.length),
          delta: failEvents.length > 0 ? '请结合下方列表排查' : '本页无失败记录',
          tone: failEvents.length > 0 ? 'danger' : 'success',
        },
      ]

      const byDay = new Map<string, number>()
      for (const e of events) {
        if (!e.occurredAt) continue
        const key = toLocalDateKey(e.occurredAt)
        if (!key) continue
        const add = Number(e.totalTokens) || 0
        byDay.set(key, (byDay.get(key) || 0) + add)
      }

      const today = new Date()
      const rawByDay: number[] = []
      const labels: string[] = []
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        labels.push(formatDayLabel(key))
        rawByDay.push(Math.round((byDay.get(key) || 0) / 1000))
      }
      const maxDay = Math.max(...rawByDay, 1)
      tokenTrend.value = labels.map((label, i) => ({
        label,
        value: Math.round((rawByDay[i]! / maxDay) * 100),
      }))

      const userDept = new Map<number, number | null>()
      for (const u of users) {
        userDept.set(u.id, u.departmentId ?? null)
      }
      const deptName = new Map<number, string>()
      for (const d of depts) {
        deptName.set(d.id, d.name?.trim() || `部门 #${d.id}`)
      }

      const deptTokens = new Map<string, { name: string; tokens: number }>()
      for (const e of events) {
        const uid = e.userId
        const tok = Number(e.totalTokens) || 0
        if (!tok) continue
        let deptId: number | null | undefined
        if (uid != null) {
          deptId = userDept.get(uid) ?? null
        } else {
          deptId = null
        }
        const key = deptId == null ? 'none' : String(deptId)
        const name = deptId == null ? '未分配部门' : (deptName.get(deptId) ?? `部门 #${deptId}`)
        const cur = deptTokens.get(key) || { name, tokens: 0 }
        cur.tokens += tok
        deptTokens.set(key, { name, tokens: cur.tokens })
      }

      const ranked = [...deptTokens.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 8)
      const maxTok = ranked[0]?.tokens || 1
      departmentUsage.value = ranked.map((row, i) => ({
        id: `dept-${i}`,
        name: row.name,
        usage: formatTokensShort(row.tokens),
        progress: Math.min(100, Math.round((row.tokens / maxTok) * 100)),
        tone: row.tokens > maxTok * 0.9 ? 'warning' : 'default',
      }))

      if (departmentUsage.value.length === 0 && totalTok > 0) {
        departmentUsage.value = [
          {
            id: 'all',
            name: '全平台（未关联部门）',
            usage: formatTokensShort(totalTok),
            progress: 100,
          },
        ]
      }

      incidents.value = failEvents.slice(0, 6).map((e, i) => {
        const st = (e.status || 'UNKNOWN').toUpperCase()
        const isSoft = st.includes('RATE') || st.includes('TIMEOUT') || st === 'CANCELLED'
        return {
          id: `inc-${e.id ?? i}`,
          title: e.errorMessage?.trim() || `调用状态：${e.status ?? '—'}`,
          meta: `${userLabel(users, e.userId)} · 项目 #${e.projectId ?? '—'} · ${formatRelativeZh(e.occurredAt)}`,
          severity: (isSoft ? 'warning' : 'critical') as Incident['severity'],
          severityLabel: isSoft ? '警告' : '异常',
        }
      })

      const sortedActs = [...events].sort((a, b) => {
        const ta = a.occurredAt ? Date.parse(a.occurredAt) : 0
        const tb = b.occurredAt ? Date.parse(b.occurredAt) : 0
        return tb - ta
      })
      activities.value = sortedActs.slice(0, 12).map((e, i) => ({
        id: `act-${e.id ?? i}`,
        time: formatRelativeZh(e.occurredAt),
        content: `${userLabel(users, e.userId)} · 项目 #${e.projectId ?? '—'} · 模型 #${e.modelId ?? '—'} · ${e.status ?? '—'} · ${formatTokensShort(Number(e.totalTokens) || 0)} tokens`,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : '仪表盘数据加载失败'
      error.value = message
      metrics.value = [...emptyMetrics]
      tokenTrend.value = []
      departmentUsage.value = []
      incidents.value = []
      activities.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    metrics,
    tokenTrend,
    departmentUsage,
    incidents,
    activities,
    loadDashboard,
  }
}
