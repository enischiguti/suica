import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- DB mocks ---
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}))

// --- Analytics mock ---
const mockRecordVisit = vi.fn()
vi.mock('~~/server/utils/analytics', () => ({
  recordVisit: mockRecordVisit,
}))

// --- Device mock ---
vi.mock('~~/server/utils/device', () => ({
  detectDevice: vi.fn(() => 'desktop'),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result') }
})

vi.stubGlobal('useRuntimeConfig', () => ({ analyticsSecret: 'test-salt' }))

// h3 helpers used in the handler - mock them
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getValidatedRouterParams: vi.fn(async (event: { context: { params: { username: string } } }, _parse: unknown) => {
      return { username: event.context.params.username }
    }),
    getRequestIP: vi.fn(() => '1.2.3.4'),
    getRequestHeader: vi.fn((_event: unknown, name: string) => {
      if (name === 'referer')
        return 'https://google.com'
      if (name === 'user-agent')
        return 'Mozilla/5.0'
      return null
    }),
  }
})

// Import default handler after mocks
const mod = await import('./visit.post')
const handler = mod.default

function makeEvent(username: string): H3Event {
  // eslint-disable-next-line ts/consistent-type-assertions
  return {
    context: { params: { username } },
    headers: new Headers({
      'user-agent': 'Mozilla/5.0',
      'referer': 'https://google.com',
    }),
    node: { req: { headers: {} }, res: {} },
  } as unknown as H3Event
}

describe('visit.post handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('records a visit for a known user', async () => {
    mockLimit.mockResolvedValue([{ id: 'user-1' }])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
    mockRecordVisit.mockResolvedValue(undefined)

    const result = await handler(makeEvent('alice'))

    expect(result).toEqual({ ok: true })
    expect(mockRecordVisit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'page:user-1' }),
    )
  })

  it('throws 404 for unknown user', async () => {
    mockLimit.mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    await expect(handler(makeEvent('nobody'))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not insert when duplicate IP within TTL (recordVisit skips insert)', async () => {
    mockLimit.mockResolvedValue([{ id: 'user-1' }])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    // Simulate recordVisit NOT calling insert (dedup case)
    mockRecordVisit.mockImplementation(async ({ insert: _insert }: { insert: () => Promise<void> }) => {
      // Do not call insert — simulates dedup
    })

    await handler(makeEvent('alice'))

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
