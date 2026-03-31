import { describe, expect, it } from 'vitest'

import { normalizeProjectsDashboard } from '../lib/normalize-projects-dashboard'

describe('normalizeProjectsDashboard', () => {
  it('reads counts from nested stats and array lengths', () => {
    const raw = {
      data: [
        {
          project: {
            id: 1,
            name: 'A',
            code: 'A',
            description: null,
            icon: null,
            projectType: 'PRODUCT',
            createdBy: null,
            ownerUserId: null,
            status: 'ACTIVE',
            createdAt: null,
            updatedAt: null,
          },
          stats: {
            memberCount: 12,
            serviceCount: 4,
            skillCount: 2,
            toolCount: 1,
            knowledgeCount: 3,
            usedTokensThisMonth: 5000,
            monthlyTokenQuota: 10000,
          },
        },
      ],
    }
    const rows = normalizeProjectsDashboard(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.serviceCount).toBe(4)
    expect(rows[0]?.memberCount).toBe(12)
    expect(rows[0]?.skillCount).toBe(2)
    expect(rows[0]?.toolCount).toBe(1)
    expect(rows[0]?.knowledgeCount).toBe(3)
    expect(rows[0]?.project.usedTokensThisMonth).toBe(5000)
    expect(rows[0]?.project.monthlyTokenQuota).toBe(10000)
  })

  it('supports Spring Page in data.content and string id', () => {
    const raw = {
      data: {
        content: [
          {
            id: '99',
            name: 'B',
            code: 'B',
            description: null,
            icon: null,
            projectType: 'OTHER',
            createdBy: null,
            ownerUserId: null,
            status: 'ACTIVE',
            createdAt: null,
            updatedAt: null,
            services: [{}, {}],
            skills: [1, 2, 3],
            tools: [],
            knowledgeBases: [1],
          },
        ],
      },
    }
    const rows = normalizeProjectsDashboard(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.project.id).toBe(99)
    expect(rows[0]?.serviceCount).toBe(2)
    expect(rows[0]?.skillCount).toBe(3)
    expect(rows[0]?.toolCount).toBe(0)
    expect(rows[0]?.knowledgeCount).toBe(1)
  })
})
