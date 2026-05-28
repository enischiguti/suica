import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({ analyticsSecret: 'test-salt' }))

const mockSet = vi.fn()
const mockRedis = { set: mockSet }

vi.mock('~~/server/utils/queue', () => ({
  useRedis: () => mockRedis,
}))

const { recordVisit } = await import('./analytics')

describe('recordVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls insert on first visit (Redis NX succeeds)', async () => {
    mockSet.mockResolvedValue('OK')
    const insert = vi.fn().mockResolvedValue(undefined)

    await recordVisit({ key: 'link-1', ip: '1.2.3.4', insert })

    expect(insert).toHaveBeenCalledOnce()
  })

  it('skips insert on duplicate visit (Redis NX returns null)', async () => {
    mockSet.mockResolvedValue(null)
    const insert = vi.fn().mockResolvedValue(undefined)

    await recordVisit({ key: 'link-1', ip: '1.2.3.4', insert })

    expect(insert).not.toHaveBeenCalled()
  })

  it('uses correct Redis key format with dedup prefix', async () => {
    mockSet.mockResolvedValue('OK')
    const insert = vi.fn().mockResolvedValue(undefined)

    await recordVisit({ key: 'my-link', ip: '10.0.0.1', insert })

    expect(mockSet).toHaveBeenCalledWith(
      expect.stringMatching(/^dedup:my-link:[a-f0-9]{64}$/),
      '1',
      'EX',
      86_400,
      'NX',
    )
  })

  it('uses custom ttlSeconds when provided', async () => {
    mockSet.mockResolvedValue('OK')
    const insert = vi.fn().mockResolvedValue(undefined)

    await recordVisit({ key: 'link-1', ip: '1.2.3.4', insert, ttlSeconds: 7200 })

    expect(mockSet).toHaveBeenCalledWith(
      expect.any(String),
      '1',
      'EX',
      7200,
      'NX',
    )
  })

  it('iP is never passed to insert function', async () => {
    mockSet.mockResolvedValue('OK')
    const ip = '192.168.1.100'
    let insertArgs: unknown[] = []
    const insert = vi.fn().mockImplementation((...args: unknown[]) => {
      insertArgs = args
      return Promise.resolve()
    })

    await recordVisit({ key: 'link-1', ip, insert })

    // insert() takes no args
    expect(insertArgs).toHaveLength(0)
    // IP does not appear in the Redis key directly (it's hashed)
    const redisKey = mockSet.mock.calls[0]?.[0]
    expect(redisKey).not.toContain(ip)
  })

  it('daily salt rotates: same IP on different dates produces different Redis keys', async () => {
    mockSet.mockResolvedValue('OK')

    const capturedKeys: string[] = []
    mockSet.mockImplementation((...args: unknown[]) => {
      capturedKeys.push(String(args[0]))
      return Promise.resolve('OK')
    })

    const insert = vi.fn().mockResolvedValue(undefined)
    const ip = '1.2.3.4'

    // Day 1
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    await recordVisit({ key: 'link-1', ip, insert })

    // Day 2
    vi.setSystemTime(new Date('2025-01-16T12:00:00Z'))
    await recordVisit({ key: 'link-1', ip, insert })

    vi.useRealTimers()

    expect(capturedKeys).toHaveLength(2)
    expect(capturedKeys[0]).not.toBe(capturedKeys[1])
  })
})
