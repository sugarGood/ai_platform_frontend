import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DashboardPage from '../features/dashboard/DashboardPage.vue'
import { jsonEnvelope } from './mock-api-envelope'

function stubProjectsFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/projects/dashboard')) {
        return new Response(
          jsonEnvelope({
            data: [
              {
                project: {
                  id: 7,
                  name: 'Integration Project',
                  code: 'INTEGRATION',
                  description: 'Integration workflow project',
                  icon: '🧩',
                  projectType: 'PRODUCT',
                  createdBy: 1,
                  ownerUserId: 1,
                  status: 'ACTIVE',
                  createdAt: '2025-01-01T00:00:00',
                  updatedAt: '2025-01-01T00:00:00',
                },
                serviceCount: 2,
                memberCount: 3,
                skillCount: 2,
                toolCount: 1,
                knowledgeCount: 1,
                members: [],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      if (url.includes('/users')) {
        return new Response(jsonEnvelope([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/usage-events')) {
        return new Response(jsonEnvelope({ data: [], total: 0, page: 1, size: 100 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardPage', () => {
  it('renders the workbench-first dashboard layout', async () => {
    stubProjectsFetch()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(DashboardPage, {
      global: {
        plugins: [router],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="dashboard-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-workbench-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-todo-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-recent-projects"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-platform-metrics"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-quick-actions"]').exists()).toBe(true)
  })
})
