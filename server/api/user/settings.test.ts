import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockWhere = vi.fn()
const mockReturning = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({ update: mockUpdate })),
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual, createError: actual.createError }
})

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result') }
})

const { applySettingsUpdate } = await import('./settings.patch')

function setupDbMock(returnedRows: { id: string, name: string | null, email: string }[]) {
  mockReturning.mockResolvedValue(returnedRows)
  mockWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

describe('applySettingsUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates DB and returns user when name is valid', async () => {
    const updatedUser = { id: 'user-1', name: 'Alice Smith', email: 'test@example.com' }
    setupDbMock([updatedUser])

    const result = await applySettingsUpdate('user-1', { name: 'Alice Smith' })
    expect(result).toEqual(updatedUser)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('saves pre-trimmed name from Zod (no extra trimming needed)', async () => {
    const updatedUser = { id: 'user-1', name: 'Bob Jones', email: 'test@example.com' }
    setupDbMock([updatedUser])

    const result = await applySettingsUpdate('user-1', { name: 'Bob Jones' })
    expect(result).toEqual(updatedUser)
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob Jones' }))
  })

  it('throws 404 when user is not found in DB', async () => {
    setupDbMock([])
    await expect(applySettingsUpdate('missing-user', { name: 'Alice' })).rejects.toMatchObject({ statusCode: 404 })
  })
})
