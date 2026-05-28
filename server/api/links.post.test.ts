import { beforeEach, describe, expect, it, vi } from 'vitest'

// Module-level mock functions — no type assertions needed
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}))

vi.mock('~~/server/utils/slug', () => ({
  isValidSlug: vi.fn((s: string) => /^[a-z0-9-]+$/.test(s) && s.length >= 1 && s.length <= 64),
  generateUniqueSlug: vi.fn(async (title: string) => title.toLowerCase().replace(/\s+/g, '-')),
}))

const mockCanAddLink = vi.fn(async () => true)
const mockGetUserPlan = vi.fn(async () => 'free')

vi.mock('~~/server/utils/plan', () => ({
  canAddLink: mockCanAddLink,
  getUserPlan: mockGetUserPlan,
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result'), and: vi.fn(() => 'and-result') }
})

const { applyCreateLink } = await import('./links.post')

function setupSelectReturns(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupInsertReturns(row: unknown) {
  mockReturning.mockResolvedValue(row ? [row] : [])
  mockValues.mockReturnValue({ returning: mockReturning })
  mockInsert.mockReturnValue({ values: mockValues })
}

describe('applyCreateLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 403 with LIMIT_REACHED when free plan link limit is hit', async () => {
    mockCanAddLink.mockResolvedValueOnce(false)
    mockGetUserPlan.mockResolvedValueOnce('free')
    // Count query ends at .where() — use isolated mocks so once-values don't leak to other tests
    const countWhere = vi.fn().mockResolvedValueOnce([{ count: 10 }])
    const countFrom = vi.fn().mockReturnValueOnce({ where: countWhere })
    mockSelect.mockReturnValueOnce({ from: countFrom })

    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 403, data: { code: 'LIMIT_REACHED', limit: 10, current: 10 } })
  })

  it('throws 403 with correct pro limit when pro plan limit is hit', async () => {
    mockCanAddLink.mockResolvedValueOnce(false)
    mockGetUserPlan.mockResolvedValueOnce('pro')
    const countWhere = vi.fn().mockResolvedValueOnce([{ count: 1000 }])
    const countFrom = vi.fn().mockReturnValueOnce({ where: countWhere })
    mockSelect.mockReturnValueOnce({ from: countFrom })

    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 403, data: { code: 'LIMIT_REACHED', limit: 1000, current: 1000 } })
  })

  it('throws 400 when title is missing', async () => {
    await expect(
      applyCreateLink('user-1', { title: '', destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when title is not a string', async () => {
    await expect(
      applyCreateLink('user-1', { title: 123, destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when destinationUrl is not a valid URL', async () => {
    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'not-a-url' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when destinationUrl is missing protocol', async () => {
    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 409 when custom slug is already taken', async () => {
    setupSelectReturns([{ id: 'existing' }])
    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'https://example.com', slug: 'my-slug' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('creates link and returns it for valid payload', async () => {
    const createdLink = {
      id: 'link-1',
      userId: 'user-1',
      title: 'My Link',
      destinationUrl: 'https://example.com',
      slug: 'my-link',
      showOnPage: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setupInsertReturns(createdLink)

    const result = await applyCreateLink('user-1', {
      title: 'My Link',
      destinationUrl: 'https://example.com',
    })
    expect(result).toMatchObject({ title: 'My Link' })
  })

  it('uses custom slug when provided and valid', async () => {
    const createdLink = {
      id: 'link-1',
      userId: 'user-1',
      title: 'My Link',
      destinationUrl: 'https://example.com',
      slug: 'custom-slug',
      showOnPage: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setupSelectReturns([]) // slug not taken
    setupInsertReturns(createdLink)

    const result = await applyCreateLink('user-1', {
      title: 'My Link',
      destinationUrl: 'https://example.com',
      slug: 'custom-slug',
    })
    expect(result).toMatchObject({ slug: 'custom-slug' })
  })
})
