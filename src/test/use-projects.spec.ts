import { afterEach, describe, expect, it, vi } from 'vitest'

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

const pageFirst = {
  data: [project101],
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(pageFirst), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const { useProjects } = await import('../composables/useProjects')
    const { loadProjects, projectState, projectSummaries } = useProjects()

    await loadProjects(true)

    expect(projectState.loadedFromApi).toBe(true)
    expect(projectSummaries.value).toHaveLength(1)
    expect(projectSummaries.value[0]?.id).toBe('101')
    expect(projectSummaries.value[0]?.name).toBe('支付网关')
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
      data: [project101, project202],
      total: 2,
      page: 1,
      size: 100,
    }

    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageFirst), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(project202), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageBoth), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const { createProject, useProjects } = await import('../composables/useProjects')
    const { loadProjects, projectSummaries } = useProjects()

    await loadProjects(true)
    await createProject({
      name: '用户中心',
      code: 'USER_CENTER',
      projectType: 'PRODUCT',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(projectSummaries.value.map((project) => project.id)).toEqual(['101', '202'])
  })
})
