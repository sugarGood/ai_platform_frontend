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
      if (url.includes('/projects') && url.includes('page=')) {
        return new Response(jsonEnvelope({ data: [], total: 0, page: 1, size: 500 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
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
  it('renders prototype-aligned stats and activity (HTML 原型工作台)', async () => {
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
    expect(wrapper.text()).toContain('本月 Token 消耗')
  })
})
