import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Session mock ---
const mockRequireSession = vi.fn()
vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(() => 'eq-result'),
    count: vi.fn(() => 'count-result'),
    desc: vi.fn(() => 'desc-result'),
  }
})

// Build a query chain that resolves to `data` regardless of how many
// chained methods are called (.from, .where, .groupBy, .orderBy, .limit)
function buildChain(data: unknown[]): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make it thenable — resolves when awaited
        return (resolve: (v: unknown) => void) => resolve(data)
      }
      if (prop === 'catch') {
        return (_reject: unknown) => buildChain(data)
      }
      // Any other property (from, where, groupBy, orderBy, limit) returns a new chain
      return () => buildChain(data)
    },
  }
  return new Proxy({}, handler)
}

let selectCallCount = 0
const responses: unknown[][] = []

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: vi.fn(() => {
      const idx = selectCallCount++
      return buildChain(responses[idx] ?? [])
    }),
  })),
}))

const { applyGetPageStats } = await import('./stats.get')

describe('applyGetPageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallCount = 0
    responses.length = 0
  })

  it('returns aggregated stats for a user', async () => {
    responses.push(
      [{ count: 42 }],
      [{ value: 'https://twitter.com', count: 10 }],
      [{ value: 'mobile', count: 20 }, { value: 'desktop', count: 22 }],
      [{ value: 'BR', count: 15 }],
    )

    const result = await applyGetPageStats('user-1')

    expect(result.total).toBe(42)
    expect(result.referrers).toHaveLength(1)
    expect(result.devices).toHaveLength(2)
    expect(result.countries).toHaveLength(1)
  })

  it('returns zero total when no visits exist', async () => {
    responses.push([], [], [], [])

    const result = await applyGetPageStats('user-1')

    expect(result.total).toBe(0)
    expect(result.referrers).toHaveLength(0)
    expect(result.devices).toHaveLength(0)
    expect(result.countries).toHaveLength(0)
  })

  it('requires auth (401 if no session)', async () => {
    mockRequireSession.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' })

    const mod = await import('./stats.get')
    const handler = mod.default

    // eslint-disable-next-line ts/consistent-type-assertions
    await expect(handler({} as unknown as Parameters<typeof handler>[0])).rejects.toMatchObject({ statusCode: 401 })
  })
})
