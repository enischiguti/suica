import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock requireSession
vi.mock('~~/server/utils/session', () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { id: 'session-1' },
  }),
}))

// Mock useDB
vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(),
}))

const mockGetQuery = vi.fn()

// Mock h3 so defineEventHandler passes through and getQuery is mockable
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
    getQuery: (...args: unknown[]) => mockGetQuery(...args),
  }
})

const { useDB } = await import('~~/server/db/index')
// eslint-disable-next-line ts/consistent-type-assertions
const handler = (await import('./check-username.get')).default as (event: unknown) => Promise<{ available: boolean }>

const mockUseDB = vi.mocked(useDB)

function makeEvent() {
  return { headers: new Headers() }
}

function makeMockDb(user: { id: string, username: string } | null) {
  return {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  }
}

describe('get /api/user/check-username', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb(null) as unknown as ReturnType<typeof useDB>)
  })

  it('returns { available: false } for invalid format', async () => {
    mockGetQuery.mockReturnValue({ username: 'Invalid!' })
    const result = await handler(makeEvent())
    expect(result).toEqual({ available: false })
  })

  it('returns { available: false } for too short username', async () => {
    mockGetQuery.mockReturnValue({ username: 'ab' })
    const result = await handler(makeEvent())
    expect(result).toEqual({ available: false })
  })

  it('returns { available: false } for reserved username', async () => {
    mockGetQuery.mockReturnValue({ username: 'admin' })
    const result = await handler(makeEvent())
    expect(result).toEqual({ available: false })
  })

  it('returns { available: false } for taken username', async () => {
    mockGetQuery.mockReturnValue({ username: 'johndoe' })
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb({ id: 'other-user', username: 'johndoe' }) as unknown as ReturnType<typeof useDB>)
    const result = await handler(makeEvent())
    expect(result).toEqual({ available: false })
  })

  it('returns { available: true } for free username', async () => {
    mockGetQuery.mockReturnValue({ username: 'johndoe' })
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb(null) as unknown as ReturnType<typeof useDB>)
    const result = await handler(makeEvent())
    expect(result).toEqual({ available: true })
  })
})
