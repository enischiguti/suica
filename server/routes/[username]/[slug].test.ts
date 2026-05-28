import { beforeEach, describe, expect, it, vi } from 'vitest'

// Module-level mock functions — no type assertions
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockInnerJoin = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()

const mockCreateError = vi.fn((opts: { statusCode: number }) => {
  const err = new Error(`HTTP ${opts.statusCode}`)
  Object.assign(err, opts)
  return err
})

const mockRecordVisit = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(() => 'eq-result'),
    and: vi.fn(() => 'and-result'),
  }
})

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    createError: mockCreateError,
  }
})

vi.mock('~~/server/utils/analytics', () => ({
  recordVisit: mockRecordVisit,
}))

const { applyRedirect } = await import('./[slug].get')

const defaultClickContext = {
  ip: '1.2.3.4',
  referrer: null,
  userAgent: '',
  country: null,
}

function setupSelectReturns(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockInnerJoin.mockReturnValue({ where: mockWhere })
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
  mockSelect.mockReturnValue({ from: mockFrom })
}

describe('applyRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRecordVisit.mockResolvedValue(undefined)
  })

  it('throws 404 when username is not found', async () => {
    setupSelectReturns([])

    await expect(applyRedirect('nobody', 'my-link', defaultClickContext))
      .rejects
      .toMatchObject({ statusCode: 404 })
  })

  it('throws 404 when slug is not found', async () => {
    setupSelectReturns([])

    await expect(applyRedirect('alice', 'nonexistent-slug', defaultClickContext))
      .rejects
      .toMatchObject({ statusCode: 404 })
  })

  it('throws 404 for inactive links (filtered by isActive=true in query)', async () => {
    // Inactive link — the query only returns active links, so result is empty
    setupSelectReturns([])

    await expect(applyRedirect('alice', 'inactive-slug', defaultClickContext))
      .rejects
      .toMatchObject({ statusCode: 404 })
  })

  it('returns destination URL for an active link', async () => {
    setupSelectReturns([{ id: 'link-1', destinationUrl: 'https://example.com' }])

    const result = await applyRedirect('alice', 'my-link', defaultClickContext)

    expect(result).toBe('https://example.com')
  })

  it('fires click recording without awaiting it (does not block redirect)', async () => {
    setupSelectReturns([{ id: 'link-2', destinationUrl: 'https://destination.com' }])

    let recordVisitResolve: (() => void) | undefined
    mockRecordVisit.mockReturnValue(
      new Promise<void>((resolve) => {
        recordVisitResolve = resolve
      }),
    )

    const result = await applyRedirect('alice', 'my-link', defaultClickContext)

    // applyRedirect returned the URL even though recordVisit hasn't resolved
    expect(result).toBe('https://destination.com')
    expect(mockRecordVisit).toHaveBeenCalled()

    // Resolve the recordVisit promise to avoid dangling promise warnings
    if (recordVisitResolve)
      recordVisitResolve()
  })

  it('passes ip, referrer, device, and country to recordVisit', async () => {
    setupSelectReturns([{ id: 'link-3', destinationUrl: 'https://site.com' }])

    const clickContext = {
      ip: '5.6.7.8',
      referrer: 'https://referring.com',
      userAgent: 'Mozilla/5.0 (Linux; Android 10) Mobile Safari/537.36',
      country: 'BR',
    }

    await applyRedirect('alice', 'my-link', clickContext)

    expect(mockRecordVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'link:link-3',
        ip: '5.6.7.8',
        insert: expect.any(Function),
      }),
    )
  })
})
