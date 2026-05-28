import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- DB mocks ---
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockLeftJoin = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockOrderBy = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
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

const { applyGetPublicProfile } = await import('./[username].get')

const baseUserRow = {
  userId: 'user-1',
  userName: 'Alice',
  userUsername: 'alice',
  userAvatarUrl: 'https://example.com/alice.jpg',
  bio: 'Hello world',
  theme: 'default',
  socials: null,
  customAvatarUrl: null,
}

const linkRow = {
  id: 'link-1',
  title: 'My site',
  destinationUrl: 'https://alice.com',
  slug: 'my-site',
  showOnPage: true,
  isActive: true,
  createdAt: new Date(),
}

describe('applyGetPublicProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns profile + links for known user', async () => {
    let selectCall = 0
    mockLimit.mockImplementation(() => {
      selectCall++
      return Promise.resolve(selectCall === 1 ? [baseUserRow] : [])
    })
    mockOrderBy.mockResolvedValue([linkRow])
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ where: mockWhere })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await applyGetPublicProfile('alice')

    expect(result.user.name).toBe('Alice')
    expect(result.user.username).toBe('alice')
    expect(result.links).toHaveLength(1)
    expect(result.links[0]?.title).toBe('My site')
  })

  it('throws 404 for unknown user', async () => {
    mockLimit.mockResolvedValue([])
    mockOrderBy.mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ where: mockWhere })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    await expect(applyGetPublicProfile('nobody')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('prefers customAvatarUrl over avatarUrl', async () => {
    const rowWithCustom = {
      ...baseUserRow,
      customAvatarUrl: 'https://cf.images/custom.jpg',
    }
    mockLimit.mockResolvedValue([rowWithCustom])
    mockOrderBy.mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ where: mockWhere })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await applyGetPublicProfile('alice')

    expect(result.profile.effectiveAvatarUrl).toBe('https://cf.images/custom.jpg')
  })

  it('falls back to avatarUrl when customAvatarUrl is null', async () => {
    mockLimit.mockResolvedValue([baseUserRow])
    mockOrderBy.mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ where: mockWhere })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await applyGetPublicProfile('alice')

    expect(result.profile.effectiveAvatarUrl).toBe('https://example.com/alice.jpg')
  })
})
