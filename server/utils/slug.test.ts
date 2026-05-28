import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLimit = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: mockLimit }),
      }),
    }),
  })),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result'), and: vi.fn(() => 'and-result') }
})

const { slugify, isValidSlug, generateUniqueSlug } = await import('./slug')

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
    expect(slugify('a'.repeat(70))).toHaveLength(60)
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
    expect(isValidSlug('a'.repeat(65))).toBe(false)
  })

  it('accepts slugs of exactly 64 chars', () => {
    expect(isValidSlug('a'.repeat(64))).toBe(true)
  })
})

describe('generateUniqueSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns base slug when no collision', async () => {
    mockLimit.mockResolvedValue([])
    const slug = await generateUniqueSlug('Hello World', 'user-1')
    expect(slug).toBe('hello-world')
  })

  it('appends suffix when base slug is taken', async () => {
    // First call (base slug) is taken, second (with suffix) is free
    mockLimit.mockResolvedValueOnce([{ id: 'taken' }]).mockResolvedValue([])
    const slug = await generateUniqueSlug('Hello World', 'user-1')
    expect(slug).toMatch(/^hello-world-[a-z0-9]{4}$/)
  })

  it('uses "link" as base when title produces empty slug', async () => {
    mockLimit.mockResolvedValue([])
    const slug = await generateUniqueSlug('!!!', 'user-1')
    expect(slug).toBe('link')
  })

  it('throws after 5 failed attempts', async () => {
    mockLimit.mockResolvedValue([{ id: 'taken' }])
    await expect(generateUniqueSlug('Hello World', 'user-1')).rejects.toThrow()
  })
})
