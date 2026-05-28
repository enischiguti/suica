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

  it('throws 400 when name is missing', async () => {
    await expect(applySettingsUpdate('user-1', {})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when name is empty string', async () => {
    await expect(applySettingsUpdate('user-1', { name: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when name is only whitespace', async () => {
    await expect(applySettingsUpdate('user-1', { name: '   ' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when body is not an object', async () => {
    await expect(applySettingsUpdate('user-1', null)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('updates DB and returns user when name is valid', async () => {
    const updatedUser = { id: 'user-1', name: 'Alice Smith', email: 'test@example.com' }
    setupDbMock([updatedUser])

    const result = await applySettingsUpdate('user-1', { name: 'Alice Smith' })
    expect(result).toEqual(updatedUser)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('trims whitespace from name before saving', async () => {
    const updatedUser = { id: 'user-1', name: 'Bob Jones', email: 'test@example.com' }
    setupDbMock([updatedUser])

    const result = await applySettingsUpdate('user-1', { name: '  Bob Jones  ' })
    expect(result).toEqual(updatedUser)
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob Jones' }))
  })
})
