import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({ encryptionKey: '0'.repeat(64) }))

// ---- Mock DB ----
const mockSelectRows = vi.fn()
const mockInsertValues = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelectRows,
    insert: vi.fn(() => ({ values: mockInsertValues })),
  })),
}))

// ---- Mock encryption ----
vi.mock('~~/server/utils/encryption', () => ({
  decryptToken: vi.fn(() => 'decrypted-access-token'),
}))

// ---- Mock queue ----
const mockQueueAdd = vi.fn()
vi.mock('~~/server/utils/queue', () => ({
  createWorker: vi.fn((_name: string, processor: (job: unknown) => Promise<void>) => ({ processor })),
  createQueue: vi.fn(() => ({ add: mockQueueAdd })),
}))

// ---- Mock DM cap ----
const mockGetDailyDmCount = vi.fn()
const mockMsUntilNextUTCMidnight = vi.fn(() => 60_000)

vi.mock('~~/server/utils/dm-cap', () => ({
  FREE_DAILY_DM_CAP: 100,
  getDailyDmCount: mockGetDailyDmCount,
  msUntilNextUTCMidnight: mockMsUntilNextUTCMidnight,
}))

// ---- Mock global fetch ----
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---- Import worker after mocks ----
const { processComment } = await import('./process-comment')

const TEST_ACCOUNT = {
  id: 'acc-1',
  userId: 'user-1',
  igUserId: 'ig-user-1',
  igUsername: 'testuser',
  accessToken: 'enc-token',
  tokenExpiresAt: null,
  connectedAt: new Date().toISOString(),
}

const TEST_AUTOMATION = {
  id: 'auto-1',
  userId: 'user-1',
  igAccountId: 'acc-1',
  name: 'Test automation',
  postIds: ['post123'],
  keywords: null,
  message: 'Hey {{username}}!',
  isActive: true,
  priority: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

interface JobData {
  igAccountId?: string
  commentId?: string
  postId?: string
  commenterUsername?: string
  commentText?: string
  commentedAt?: string
}

function makeJobData(overrides: JobData = {}) {
  return {
    igAccountId: 'acc-1',
    commentId: 'comment-1',
    postId: 'post123',
    commenterUsername: 'alice',
    commentText: 'nice post!',
    commentedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeSelectChain(data: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(data)),
    innerJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(data)),
  }
  return chain
}

function setupSelectSequence(results: unknown[][]) {
  let callCount = 0
  mockSelectRows.mockImplementation(() => {
    const data = results[callCount++] ?? []
    return makeSelectChain(data)
  })
}

describe('process-comment worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({ message_id: 'msg-1' }),
    })
    mockGetDailyDmCount.mockResolvedValue(0)
    mockInsertValues.mockResolvedValue([])
  })

  it('staleness drop: comment older than 23h55m → logs dropped, no DM sent', async () => {
    const staleTime = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString()

    await processComment(makeJobData({ commentedAt: staleTime }))

    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'dropped' }))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('dedup skip: existing sent log → skips without sending DM', async () => {
    setupSelectSequence([[{ id: 'log-1' }]])

    await processComment(makeJobData())

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('keyword match: comment with keyword fires DM', async () => {
    const automationWithKeyword = { ...TEST_AUTOMATION, keywords: ['nice', 'great'] }
    setupSelectSequence([
      [], // dedup: no existing log
      [TEST_ACCOUNT], // account lookup
      [automationWithKeyword], // automations
    ])

    await processComment(makeJobData({ commentText: 'nice post!' }))

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
  })

  it('keyword no-match: comment without keyword does not fire DM', async () => {
    const automationWithKeyword = { ...TEST_AUTOMATION, keywords: ['buy', 'price'] }
    setupSelectSequence([
      [], // dedup
      [TEST_ACCOUNT], // account
      [automationWithKeyword], // automations
    ])

    await processComment(makeJobData({ commentText: 'cool photo' }))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('priority order: first matching automation fires, second is not evaluated', async () => {
    const auto1 = { ...TEST_AUTOMATION, id: 'auto-1', priority: 0, message: 'First match' }
    const auto2 = { ...TEST_AUTOMATION, id: 'auto-2', priority: 1, message: 'Second match' }
    setupSelectSequence([
      [], // dedup
      [TEST_ACCOUNT], // account
      [auto1, auto2], // automations ordered by priority
    ])

    await processComment(makeJobData())

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ automationId: 'auto-1' }))
  })

  it('dM cap free user: when getDailyDmCount >= 100 → job re-enqueued, no log inserted', async () => {
    mockGetDailyDmCount.mockResolvedValue(100)
    setupSelectSequence([
      [], // dedup
      [TEST_ACCOUNT], // account
      [TEST_AUTOMATION], // automations
    ])

    await processComment(makeJobData())

    expect(mockQueueAdd).toHaveBeenCalledOnce()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('dM cap bypass: when count < 100 → DM sent', async () => {
    mockGetDailyDmCount.mockResolvedValue(50)
    setupSelectSequence([
      [], // dedup
      [TEST_ACCOUNT], // account
      [TEST_AUTOMATION], // automations
    ])

    await processComment(makeJobData())

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
  })
})
