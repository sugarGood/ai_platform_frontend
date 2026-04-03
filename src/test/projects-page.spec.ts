import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProjectsPage from '../features/projects/ProjectsPage.vue'
import { jsonEnvelope } from './mock-api-envelope'

const projectsDashboardPayload = {
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
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProjectsPage', () => {
  it('renders the compact toolbar summary above the project list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/projects/dashboard')) {
          return new Response(jsonEnvelope(projectsDashboardPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('not found', { status: 404 })
      }),
    )

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(ProjectsPage, {
      global: {
        plugins: [router],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="projects-summary-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="projects-card-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="projects-summary-count"]').text()).toContain('1')
  })
})
