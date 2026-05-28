import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid'),
})

// ---- Shared DB mock state ----
const mockSelectRows = vi.fn()
const mockUpdateSet = vi.fn()
const mockDeleteWhere = vi.fn()
const mockTransaction = vi.fn()

// Insert mock: tracks the last inserted value and supports .returning()
const mockInsertCalled = vi.fn()

function makeInsertChain(returnVal: unknown[]) {
  const chain = {
    values: vi.fn((data: unknown) => {
      mockInsertCalled(data)
      return {
        returning: vi.fn(() => Promise.resolve(returnVal)),
      }
    }),
  }
  return chain
}

function makeSelectChain(data: unknown[]) {
  const resolved = Promise.resolve(data)
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => resolved),
    orderBy: vi.fn(() => resolved),
    innerJoin: vi.fn(() => chain),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  }
  return chain
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([{ id: 'auto-1', name: 'updated' }])),
  }
  mockUpdateSet.mockReturnValue(chain)
  return chain
}

function makeDeleteChain() {
  const chain = {
    where: vi.fn(() => Promise.resolve()),
  }
  mockDeleteWhere.mockReturnValue(chain)
  return chain
}

let currentInsertChain = makeInsertChain([])

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelectRows,
    insert: vi.fn(() => currentInsertChain),
    update: mockUpdateSet,
    delete: mockDeleteWhere,
    transaction: mockTransaction,
  })),
}))

describe('automations CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('applyGetAutomations', () => {
    it('returns automations ordered by priority', async () => {
      const rows = [
        { id: 'auto-1', priority: 0 },
        { id: 'auto-2', priority: 1 },
      ]
      mockSelectRows.mockReturnValue(makeSelectChain(rows))

      const { applyGetAutomations } = await import('./automations.get')
      const result = await applyGetAutomations('user-1')

      expect(result).toEqual(rows)
    })

    it('returns empty array when user has no automations', async () => {
      mockSelectRows.mockReturnValue(makeSelectChain([]))
      const { applyGetAutomations } = await import('./automations.get')
      const result = await applyGetAutomations('user-1')
      expect(result).toEqual([])
    })
  })

  describe('applyCreateAutomation', () => {
    it('creates automation with incremented priority', async () => {
      let callCount = 0
      mockSelectRows.mockImplementation(() => {
        const idx = callCount++
        if (idx === 0)
          return makeSelectChain([{ id: 'acc-1' }]) // igAccount ownership check
        if (idx === 1)
          return makeSelectChain([{ maxPriority: 2 }]) // max priority
        return makeSelectChain([])
      })

      const created = {
        id: 'test-uuid',
        userId: 'user-1',
        igAccountId: 'acc-1',
        name: 'Test',
        postIds: ['post1'],
        keywords: null,
        message: 'Hello!',
        isActive: true,
        priority: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      currentInsertChain = makeInsertChain([created])

      const { applyCreateAutomation } = await import('./automations.post')
      const result = await applyCreateAutomation('user-1', {
        name: 'Test',
        igAccountId: 'acc-1',
        postIds: ['post1'],
        message: 'Hello!',
      })

      expect(result).toMatchObject({ id: 'test-uuid', priority: 3 })
      expect(mockInsertCalled).toHaveBeenCalledWith(expect.objectContaining({ priority: 3 }))
    })

    it('sets priority to 0 for first automation', async () => {
      let callCount = 0
      mockSelectRows.mockImplementation(() => {
        const idx = callCount++
        if (idx === 0)
          return makeSelectChain([{ id: 'acc-1' }]) // igAccount ownership check
        if (idx === 1)
          return makeSelectChain([{ maxPriority: null }]) // max priority
        return makeSelectChain([])
      })

      const created = {
        id: 'test-uuid',
        userId: 'user-1',
        igAccountId: 'acc-1',
        name: 'First',
        postIds: ['post1'],
        keywords: null,
        message: 'Hi!',
        isActive: true,
        priority: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      currentInsertChain = makeInsertChain([created])

      const { applyCreateAutomation } = await import('./automations.post')
      await applyCreateAutomation('user-1', {
        name: 'First',
        igAccountId: 'acc-1',
        postIds: ['post1'],
        message: 'Hi!',
      })

      expect(mockInsertCalled).toHaveBeenCalledWith(expect.objectContaining({ priority: 0 }))
    })

    it('throws 400 when igAccountId does not belong to user', async () => {
      mockSelectRows.mockReturnValue(makeSelectChain([]))

      const { applyCreateAutomation } = await import('./automations.post')
      await expect(applyCreateAutomation('user-1', {
        name: 'Test',
        igAccountId: 'other-acc',
        postIds: ['post1'],
        message: 'Hello!',
      })).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('applyUpdateAutomation', () => {
    it('updates automation when ownership matches', async () => {
      const existing = {
        id: 'auto-1',
        userId: 'user-1',
        igAccountId: 'acc-1',
        name: 'Old name',
        postIds: ['post1'],
        keywords: null,
        message: 'Old message',
        isActive: true,
        priority: 0,
      }
      mockSelectRows.mockReturnValue(makeSelectChain([existing]))
      makeUpdateChain()

      const { applyUpdateAutomation } = await import('./automations/[id].patch')
      const result = await applyUpdateAutomation('auto-1', 'user-1', { name: 'New name' })

      expect(result).toBeDefined()
    })

    it('throws 403 when automation belongs to different user', async () => {
      const existing = { id: 'auto-1', userId: 'other-user', name: 'Test' }
      mockSelectRows.mockReturnValue(makeSelectChain([existing]))

      const { applyUpdateAutomation } = await import('./automations/[id].patch')
      await expect(applyUpdateAutomation('auto-1', 'user-1', { name: 'Hacked' })).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('throws 404 when automation not found', async () => {
      mockSelectRows.mockReturnValue(makeSelectChain([]))

      const { applyUpdateAutomation } = await import('./automations/[id].patch')
      await expect(applyUpdateAutomation('nonexistent', 'user-1', {})).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('applyDeleteAutomation', () => {
    it('deletes automation when ownership matches', async () => {
      const existing = { id: 'auto-1', userId: 'user-1', name: 'Test' }
      mockSelectRows.mockReturnValue(makeSelectChain([existing]))
      makeDeleteChain()

      const { applyDeleteAutomation } = await import('./automations/[id].delete')
      const result = await applyDeleteAutomation('auto-1', 'user-1')

      expect(result).toEqual({ ok: true })
      expect(mockDeleteWhere).toHaveBeenCalled()
    })

    it('throws 403 for wrong user', async () => {
      const existing = { id: 'auto-1', userId: 'other-user', name: 'Test' }
      mockSelectRows.mockReturnValue(makeSelectChain([existing]))

      const { applyDeleteAutomation } = await import('./automations/[id].delete')
      await expect(applyDeleteAutomation('auto-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('throws 404 when not found', async () => {
      mockSelectRows.mockReturnValue(makeSelectChain([]))

      const { applyDeleteAutomation } = await import('./automations/[id].delete')
      await expect(applyDeleteAutomation('nonexistent', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('applyReorderAutomations', () => {
    it('updates priority for each id in transaction', async () => {
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve()),
            })),
          })),
        }
        await fn(tx)
      })

      const { applyReorderAutomations } = await import('./automations/reorder.patch')
      const result = await applyReorderAutomations('user-1', ['auto-2', 'auto-1', 'auto-3'])

      expect(result).toEqual({ ok: true })
      expect(mockTransaction).toHaveBeenCalledOnce()
    })
  })
})
