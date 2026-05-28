import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockGroupBy = vi.fn()
const mockOrderBy = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({ select: mockSelect })),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(() => 'eq-result'),
    count: vi.fn(() => 'count-result'),
    desc: vi.fn(x => x),
  }
})

const { applyGetLinkStats } = await import('./stats.get')

const mockLink = { id: 'link-1', userId: 'user-1' }

let callIndex = 0
const responses: unknown[][] = []

function setupSequence(resps: unknown[][]) {
  responses.length = 0
  responses.push(...resps)
  callIndex = 0

  // All queries end with .limit() — ownership check and total use it directly,
  // referrers/devices/countries go through .groupBy().orderBy().limit()
  mockLimit.mockImplementation(() => Promise.resolve(responses[callIndex++] ?? []))
  mockOrderBy.mockReturnValue({ limit: mockLimit })
  mockGroupBy.mockReturnValue({ orderBy: mockOrderBy })
  mockWhere.mockReturnValue({ limit: mockLimit, groupBy: mockGroupBy })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

describe('applyGetLinkStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callIndex = 0
  })

  it('throws 404 when link is not found', async () => {
    setupSequence([[]])
    await expect(applyGetLinkStats('missing', 'user-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when user does not own the link', async () => {
    setupSequence([[mockLink]])
    await expect(applyGetLinkStats('link-1', 'other-user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns stats with total, referrers, devices, countries', async () => {
    setupSequence([
      [mockLink], // ownership check
      [{ total: 42 }], // total count
      [{ value: 'https://t.co', count: 10 }], // referrers
      [{ value: 'mobile', count: 30 }], // devices
      [{ value: 'BR', count: 25 }], // countries
    ])

    const result = await applyGetLinkStats('link-1', 'user-1')
    expect(result.total).toBe(42)
    expect(result.referrers).toHaveLength(1)
    expect(result.devices).toHaveLength(1)
    expect(result.countries).toHaveLength(1)
  })
})
