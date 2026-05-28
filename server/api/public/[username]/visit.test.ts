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

const { applyRecordPageVisit } = await import('./visit.post')

const defaultCtx = {
  ip: '1.2.3.4',
  referrer: 'https://google.com',
  userAgent: 'Mozilla/5.0',
  country: null,
}

describe('applyRecordPageVisit', () => {
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

    await applyRecordPageVisit('alice', defaultCtx)

    expect(mockRecordVisit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'page:user-1' }),
    )
  })

  it('throws 404 for unknown user', async () => {
    mockLimit.mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    await expect(applyRecordPageVisit('nobody', defaultCtx)).rejects.toMatchObject({ statusCode: 404 })
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

    await applyRecordPageVisit('alice', defaultCtx)

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
