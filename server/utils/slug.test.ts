import { describe, expect, it, vi } from 'vitest'

// Mock useDB and drizzle-orm for generateUniqueSlug
vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(() => 'eq-result'),
    and: vi.fn(() => 'and-result'),
  }
})

const { slugify, isValidSlug, generateUniqueSlug } = await import('./slug')
const { useDB } = await import('~~/server/db/index')
const mockUseDB = vi.mocked(useDB)

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('lowercases input', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips special characters', () => {
    expect(slugify('hello & world!')).toBe('hello--world')
  })

  it('strips non-alphanumeric except hyphens', () => {
    expect(slugify('foo@bar.baz')).toBe('foobarbaz')
  })

  it('truncates at 60 chars', () => {
    const long = 'a'.repeat(70)
    expect(slugify(long)).toHaveLength(60)
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('keeps existing hyphens', () => {
    expect(slugify('my-link-title')).toBe('my-link-title')
  })
})

describe('isValidSlug', () => {
  it('accepts valid lowercase-alphanumeric slugs', () => {
    expect(isValidSlug('hello-world')).toBe(true)
    expect(isValidSlug('abc123')).toBe(true)
    expect(isValidSlug('a')).toBe(true)
  })

  it('rejects slugs with uppercase letters', () => {
    expect(isValidSlug('Hello-World')).toBe(false)
    expect(isValidSlug('ABC')).toBe(false)
  })

  it('rejects slugs with spaces', () => {
    expect(isValidSlug('hello world')).toBe(false)
  })

  it('rejects slugs with special characters', () => {
    expect(isValidSlug('hello@world')).toBe(false)
    expect(isValidSlug('hello.world')).toBe(false)
    expect(isValidSlug('hello_world')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects slugs longer than 64 chars', () => {
    const long = 'a'.repeat(65)
    expect(isValidSlug(long)).toBe(false)
  })

  it('accepts slugs of exactly 64 chars', () => {
    const max = 'a'.repeat(64)
    expect(isValidSlug(max)).toBe(true)
  })
})

describe('generateUniqueSlug', () => {
  function makeDbMock(existingCount: number) {
    let callCount = 0
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++
              // Return existing rows for the first N attempts
              return Promise.resolve(callCount <= existingCount ? [{ id: 'taken' }] : [])
            }),
          }),
        }),
      }),
    }
  }

  it('returns base slug when no collision', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock(0) as unknown as ReturnType<typeof useDB>)

    const slug = await generateUniqueSlug('Hello World', 'user-1')
    expect(slug).toBe('hello-world')
  })

  it('appends suffix when base slug is taken', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock(1) as unknown as ReturnType<typeof useDB>)

    const slug = await generateUniqueSlug('Hello World', 'user-1')
    expect(slug).toMatch(/^hello-world-[a-z0-9]{4}$/)
  })

  it('uses "link" as base when title produces empty slug', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock(0) as unknown as ReturnType<typeof useDB>)

    const slug = await generateUniqueSlug('!!!', 'user-1')
    expect(slug).toBe('link')
  })

  it('throws after 5 failed attempts', async () => {
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeDbMock(10) as unknown as ReturnType<typeof useDB>)

    await expect(generateUniqueSlug('Hello World', 'user-1')).rejects.toThrow()
  })
})
