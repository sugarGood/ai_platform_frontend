import { afterEach, describe, expect, it, vi } from 'vitest'

import { jsonEnvelope } from './mock-api-envelope'

function apiUrlIncludes(url: string, fragment: string) {
  return url.includes(fragment)
}

/** loadProjects 使用 GET `/projects/dashboard`；按调用顺序返回聚合列表 JSON */
function stubProjectsFetch(opts: {
  dashboardSequences: Array<{ data: unknown[]; total: number; page: number; size: number }>
  createdBody?: unknown
}) {
  let dashPull = 0
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (
      method === 'POST' &&
      apiUrlIncludes(url, '/projects') &&
      !/\/projects\/\d+/.test(url)
    ) {
      return new Response(jsonEnvelope(opts.createdBody ?? null), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (method === 'GET' && apiUrlIncludes(url, '/projects/dashboard')) {
      const seq = opts.dashboardSequences
      const page = seq[Math.min(dashPull, seq.length - 1)] ?? seq[0]
      dashPull += 1
      return new Response(jsonEnvelope(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(jsonEnvelope([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

const project101 = {
  id: 101,
  name: '支付网关',
  code: 'PAYMENT_GATEWAY',
  description: null,
  icon: null,
  projectType: 'PLATFORM',
  createdBy: 1,
  ownerUserId: 1,
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00',
  updatedAt: '2025-01-01T00:00:00',
}

const project101Dashboard = {
  ...project101,
  memberCount: 2,
  serviceCount: 1,
  skillCount: 2,
  toolCount: 1,
  knowledgeCount: 3,
  members: ['张三（ADMIN）', '李四（MEMBER）'],
}

const pageFirst = {
  data: [project101Dashboard],
  total: 1,
  page: 1,
  size: 100,
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('useProjects', () => {
  it('loads projects from backend api', async () => {
    vi.stubGlobal('fetch', stubProjectsFetch({ dashboardSequences: [pageFirst] }))

    const { useProjects } = await import('../composables/useProjects')
    const { loadProjects, projectState, projectSummaries } = useProjects()

    await loadProjects(true)

    expect(projectState.loadedFromApi).toBe(true)
    expect(projectSummaries.value).toHaveLength(1)
    expect(projectSummaries.value[0]?.id).toBe('101')
    expect(projectSummaries.value[0]?.name).toBe('支付网关')
    expect(projectSummaries.value[0]?.listMetricsLoaded).toBe(true)
    expect(projectSummaries.value[0]?.aiCapabilityItems).toHaveLength(3)
    expect(projectSummaries.value[0]?.memberCount).toBe(2)
    expect(projectSummaries.value[0]?.aiCapabilityItems?.[2]?.count).toBe(3)
  })

  it('creates project then refreshes list', async () => {
    const project202 = {
      id: 202,
      name: '用户中心',
      code: 'USER_CENTER',
      description: null,
      icon: null,
      projectType: 'PRODUCT',
      createdBy: 1,
      ownerUserId: 1,
      status: 'ACTIVE',
      createdAt: '2025-01-02T00:00:00',
      updatedAt: '2025-01-02T00:00:00',
    }

    const pageBoth = {
      data: [
        project101Dashboard,
        {
          ...project202,
          memberCount: 0,
          serviceCount: 0,
          skillCount: 0,
          toolCount: 0,
          knowledgeCount: 0,
          members: [],
        },
      ],
      total: 2,
      page: 1,
      size: 100,
    }

    const fetchMock = stubProjectsFetch({
      dashboardSequences: [pageFirst, pageBoth],
      createdBody: project202,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { createProject, useProjects } = await import('../composables/useProjects')
    const { loadProjects, projectSummaries } = useProjects()

    await loadProjects(true)
    await createProject({
      name: '用户中心',
      code: 'USER_CENTER',
      projectType: 'PRODUCT',
    })

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(projectSummaries.value.map((project) => project.id)).toEqual(['101', '202'])
  })
})
