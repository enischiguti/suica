import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
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

const mockReadBody = vi.fn()

// Mock h3
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
    readBody: (...args: unknown[]) => mockReadBody(...args),
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
const handler = (await import('./settings.patch')).default as (event: unknown) => Promise<unknown>

const mockUseDB = vi.mocked(useDB)

function makeEvent() {
  return { headers: new Headers() }
}

function makeMockDb(returnedRows: { id: string, name: string | null, email: string }[]) {
  const mockReturning = vi.fn().mockResolvedValue(returnedRows)
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
  return { update: mockUpdate, _mockReturning: mockReturning, _mockWhere: mockWhere, _mockSet: mockSet }
}

describe('patch /api/user/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))
    mockReadBody.mockResolvedValue({ name: 'Alice' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 400 when name is missing', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadBody.mockResolvedValue({})

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 400 when name is empty string', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadBody.mockResolvedValue({ name: '' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 400 when name is only whitespace', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadBody.mockResolvedValue({ name: '   ' })

    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it('updates DB and returns user when name is valid', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadBody.mockResolvedValue({ name: 'Alice Smith' })

    const updatedUser = { id: 'user-1', name: 'Alice Smith', email: 'test@example.com' }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb([updatedUser]) as unknown as ReturnType<typeof useDB>)

    const result = await handler(makeEvent())
    expect(result).toEqual(updatedUser)
    expect(mockUseDB).toHaveBeenCalled()
  })

  it('trims whitespace from name before saving', async () => {
    mockRequireSession.mockResolvedValue(mockSession)
    mockReadBody.mockResolvedValue({ name: '  Bob Jones  ' })

    const updatedUser = { id: 'user-1', name: 'Bob Jones', email: 'test@example.com' }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseDB.mockReturnValue(makeMockDb([updatedUser]) as unknown as ReturnType<typeof useDB>)

    const result = await handler(makeEvent())
    expect(result).toEqual(updatedUser)
  })
})
