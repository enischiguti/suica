import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockDelete = vi.fn()
const mockDeleteWhere = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
    delete: mockDelete,
  })),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result') }
})

const { applyDeleteLink } = await import('./[id].delete')

interface MockLink { id: string, userId: string }

function setupSelect(row: MockLink | null) {
  mockLimit.mockResolvedValue(row ? [row] : [])
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupDelete() {
  mockDeleteWhere.mockResolvedValue(undefined)
  mockDelete.mockReturnValue({ where: mockDeleteWhere })
}

describe('applyDeleteLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 404 when link is not found', async () => {
    setupSelect(null)
    await expect(applyDeleteLink('missing', 'user-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when user does not own the link', async () => {
    setupSelect({ id: 'link-1', userId: 'user-1' })
    await expect(applyDeleteLink('link-1', 'other-user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('deletes link and returns ok when user owns it', async () => {
    setupSelect({ id: 'link-1', userId: 'user-1' })
    setupDelete()
    const result = await applyDeleteLink('link-1', 'user-1')
    expect(result).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalled()
  })
})
