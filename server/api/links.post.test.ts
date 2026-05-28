import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(),
}))

vi.mock('~~/server/utils/slug', () => ({
  isValidSlug: vi.fn((s: string) => /^[a-z0-9-]+$/.test(s) && s.length >= 1 && s.length <= 64),
  generateUniqueSlug: vi.fn(async (title: string) => title.toLowerCase().replace(/\s+/g, '-')),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result'), and: vi.fn(() => 'and-result') }
})

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual }
})

const { useDB } = await import('~~/server/db/index')
const mockUseDB = vi.mocked(useDB)
const { applyCreateLink } = await import('./links.post')

function makeDbMock(options: {
  existingSlug?: boolean
  createdLink?: Record<string, unknown>
  hasSlugCheck?: boolean
}) {
  const { existingSlug = false, createdLink, hasSlugCheck = false } = options

  const mockLimit = vi.fn()
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

  const mockReturning = vi.fn().mockResolvedValue(undefined)
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockReturning })
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues })

  let callCount = 0
  mockLimit.mockImplementation(() => {
    callCount++
    if (hasSlugCheck && callCount === 1) {
      // Slug uniqueness check
      return Promise.resolve(existingSlug ? [{ id: 'existing' }] : [])
    }
    // Fetch after insert
    return Promise.resolve(createdLink ? [createdLink] : [])
  })

  return {
    select: mockSelect,
    insert: mockInsert,
  }
}

describe('applyCreateLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 400 when title is missing', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({}) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyCreateLink('user-1', { title: '', destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when title is not a string', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({}) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyCreateLink('user-1', { title: 123, destinationUrl: 'https://example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when destinationUrl is not a valid URL', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({}) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'not-a-url' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when destinationUrl is missing protocol', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({}) as unknown as ReturnType<typeof useDB>)
    await expect(
      applyCreateLink('user-1', { title: 'My Link', destinationUrl: 'example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 409 when custom slug is already taken', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ existingSlug: true, hasSlugCheck: true }) as unknown as ReturnType<typeof useDB>)
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
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ createdLink }) as unknown as ReturnType<typeof useDB>)

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
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock({ createdLink, hasSlugCheck: true }) as unknown as ReturnType<typeof useDB>)

    const result = await applyCreateLink('user-1', {
      title: 'My Link',
      destinationUrl: 'https://example.com',
      slug: 'custom-slug',
    })
    expect(result).toMatchObject({ slug: 'custom-slug' })
  })
})
