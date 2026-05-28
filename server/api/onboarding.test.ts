import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  session: { id: 'session-1' },
}

const mockRequireSession = vi.fn()

// Mock requireSession
vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

// Mock useDB
vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(),
}))

const mockReadValidatedBody = vi.fn()

// Mock h3
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
    readValidatedBody: (...args: unknown[]) => mockReadValidatedBody(...args),
  }
})

// Mock drizzle-orm eq
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => 'eq-result'),
  }
})

const { useDB } = await import('~~/server/db/index')
// eslint-disable-next-line ts/consistent-type-assertions
const handler = (await import('./onboarding.post')).default as (event: unknown) => Promise<unknown>

const mockUseDB = vi.mocked(useDB)

const mockWhere = vi.fn().mockResolvedValue(undefined)
const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

function makeEvent() {
  return { headers: new Headers() }
}

function makeMockDb(existingUser: { id: string } | null) {
  return {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(existingUser),
      },
    },
    update: mockUpdate,
  }
}

describe('post /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue(undefined)
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb(null) as unknown as ReturnType<typeof useDB>)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireSession.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))
    mockReadValidatedBody.mockResolvedValue({ username: 'johndoe', useCase: 'personal-page' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 422 for invalid useCase', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadValidatedBody.mockRejectedValue(Object.assign(new Error('Validation error'), { statusCode: 422 }))

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 422 })
  })

  it('returns 400 for reserved username', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadValidatedBody.mockResolvedValue({ username: 'admin', useCase: 'personal-page' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns { ok: true } for valid payload and updates DB', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadValidatedBody.mockResolvedValue({ username: 'johndoe', useCase: 'personal-page' })

    const result = await handler(makeEvent())
    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalled()
  })
})
