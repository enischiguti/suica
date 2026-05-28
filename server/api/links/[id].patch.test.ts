import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(),
}))

vi.mock('~~/server/utils/slug', () => ({
  isValidSlug: vi.fn((s: string) => /^[a-z0-9-]+$/.test(s) && s.length >= 1 && s.length <= 64),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result'), and: vi.fn(() => 'and-result') }
})

const { useDB } = await import('~~/server/db/index')
const mockUseDB = vi.mocked(useDB)
const { applyUpdateLink } = await import('./[id].patch')

interface MockLink {
  id: string
  userId: string
  title: string
  destinationUrl: string
  slug: string
  showOnPage: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function makeDbMock(options: {
  existingLink?: MockLink | null
  slugConflict?: boolean
  updatedLink?: MockLink
}) {
  const { existingLink = null, slugConflict = false, updatedLink } = options

  let selectCallCount = 0

  const mockLimit = vi.fn()
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockImplementation(() => {
    return { from: mockFrom }
  })

  mockLimit.mockImplementation(() => {
    selectCallCount++
    if (selectCallCount === 1) {
      // First call: fetch link by id
      return Promise.resolve(existingLink ? [existingLink] : [])
    }
    // Second call: slug uniqueness check
    return Promise.resolve(slugConflict ? [{ id: 'other' }] : [])
  })

  const mockReturning = vi.fn().mockResolvedValue(updatedLink ? [updatedLink] : [])
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
  const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

  return { select: mockSelect, update: mockUpdate }
}

const sampleLink: MockLink = {
  id: 'link-1',
  userId: 'user-1',
  title: 'Test Link',
  destinationUrl: 'https://example.com',
  slug: 'test-link',
  showOnPage: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('applyUpdateLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 404 when link is not found', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: null }) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyUpdateLink('nonexistent', 'user-1', { title: 'New Title' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when user does not own the link', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: sampleLink }) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyUpdateLink('link-1', 'other-user', { title: 'New Title' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('updates link and returns updated link for valid payload', async () => {
    const updatedLink = { ...sampleLink, title: 'Updated Title' }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: sampleLink, updatedLink }) as unknown as ReturnType<typeof useDB>)

    const result = await applyUpdateLink('link-1', 'user-1', { title: 'Updated Title' })
    expect(result).toMatchObject({ title: 'Updated Title' })
  })

  it('throws 409 when new slug conflicts with existing link', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: sampleLink, slugConflict: true }) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyUpdateLink('link-1', 'user-1', { slug: 'taken-slug' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('allows updating showOnPage to false', async () => {
    const updatedLink = { ...sampleLink, showOnPage: false }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: sampleLink, updatedLink }) as unknown as ReturnType<typeof useDB>)

    const result = await applyUpdateLink('link-1', 'user-1', { showOnPage: false })
    expect(result).toMatchObject({ showOnPage: false })
  })

  it('allows deactivating a link', async () => {
    const updatedLink = { ...sampleLink, isActive: false }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingLink: sampleLink, updatedLink }) as unknown as ReturnType<typeof useDB>)

    const result = await applyUpdateLink('link-1', 'user-1', { isActive: false })
    expect(result).toMatchObject({ isActive: false })
  })
})
