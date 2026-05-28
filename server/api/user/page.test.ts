import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- DB mocks ---
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockOnConflictDoUpdate = vi.fn()
const mockReturning = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    insert: mockInsert,
  })),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result') }
})

// --- Session mock ---
const mockRequireSession = vi.fn()
vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

// --- h3 mock ---
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readValidatedBody: vi.fn(async (_event: unknown, parse: (v: unknown) => unknown) => {
      return parse({
        bio: 'Hello world',
        theme: 'midnight',
        socials: [],
        customAvatarUrl: null,
      })
    }),
  }
})

const { applyUpdatePage } = await import('./page.patch')

const updatedRow = {
  id: 'profile-1',
  userId: 'user-1',
  bio: 'Hello world',
  theme: 'midnight',
  socials: [],
  customAvatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('applyUpdatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReturning.mockResolvedValue([updatedRow])
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('upserts profile and returns updated profile', async () => {
    const result = await applyUpdatePage('user-1', {
      bio: 'Hello world',
      theme: 'midnight',
      socials: [],
      customAvatarUrl: null,
    })

    expect(mockInsert).toHaveBeenCalled()
    expect(mockOnConflictDoUpdate).toHaveBeenCalled()
    expect(result).toMatchObject({ userId: 'user-1', bio: 'Hello world', theme: 'midnight' })
  })
})

// Test the full handler requires auth
describe('page.patch handler (auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReturning.mockResolvedValue([updatedRow])
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('throws 401 if no session', async () => {
    mockRequireSession.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' })

    // requireSession throws before any other logic runs — pass a plain object as event
    const mod = await import('./page.patch')
    await expect(mod.default(Object.create(null))).rejects.toMatchObject({ statusCode: 401 })
  })
})
