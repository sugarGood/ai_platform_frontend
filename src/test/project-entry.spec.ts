import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App.vue'
import { routes } from '../router'

const listProjectPayload = {
  data: [
    {
      id: 7,
      name: '联调项目',
      code: 'INTEGRATION',
      description: null,
      icon: null,
      projectType: 'PRODUCT',
      createdBy: 1,
      ownerUserId: 1,
      status: 'ACTIVE',
      createdAt: '2025-01-01T00:00:00',
      updatedAt: '2025-01-01T00:00:00',
    },
  ],
  total: 1,
  page: 1,
  size: 100,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('project entry', () => {
  it('navigates from projects to project overview when a project is selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/projects') && url.includes('page=')) {
          return new Response(JSON.stringify(listProjectPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('not found', { status: 404 })
      }),
    )

    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    router.push('/projects')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()
    await wrapper.find('.project-card[data-project-id="7"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/projects/7/overview')
  })
})
