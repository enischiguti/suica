import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- DB mock ----
const mockSelect = vi.fn()

function makeSelectChain(data: unknown[]) {
  const resolved = Promise.resolve(data)
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => resolved),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  }
  return chain
}

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
  })),
}))

vi.mock('~~/server/utils/dm-cap', () => ({
  getDailyDmCount: vi.fn(async () => 42),
}))

describe('getUserPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns pro when subscriptionStatus is active', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: 'active' }]))
    const { getUserPlan } = await import('./plan')
    expect(await getUserPlan('user-1')).toBe('pro')
  })

  it('returns pro when subscriptionStatus is trialing', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: 'trialing' }]))
    const { getUserPlan } = await import('./plan')
    expect(await getUserPlan('user-1')).toBe('pro')
  })

  it('returns free when subscriptionStatus is null', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: null }]))
    const { getUserPlan } = await import('./plan')
    expect(await getUserPlan('user-1')).toBe('free')
  })

  it('returns free when subscriptionStatus is canceled', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: 'canceled' }]))
    const { getUserPlan } = await import('./plan')
    expect(await getUserPlan('user-1')).toBe('free')
  })

  it('returns free when user not found', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]))
    const { getUserPlan } = await import('./plan')
    expect(await getUserPlan('unknown')).toBe('free')
  })
})

describe('canAddLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns true when free user has fewer than 10 links', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: null }]) // getUserPlan
      return makeSelectChain([{ count: 5 }]) // link count
    })
    const { canAddLink } = await import('./plan')
    expect(await canAddLink('user-1')).toBe(true)
  })

  it('returns false when free user has 10 links (at limit)', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: null }])
      return makeSelectChain([{ count: 10 }])
    })
    const { canAddLink } = await import('./plan')
    expect(await canAddLink('user-1')).toBe(false)
  })

  it('returns false when free user exceeds limit', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: null }])
      return makeSelectChain([{ count: 12 }])
    })
    const { canAddLink } = await import('./plan')
    expect(await canAddLink('user-1')).toBe(false)
  })

  it('returns true for pro user with 999 links (under 1000 limit)', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: 'active' }])
      return makeSelectChain([{ count: 999 }])
    })
    const { canAddLink } = await import('./plan')
    expect(await canAddLink('user-1')).toBe(true)
  })

  it('returns false for pro user at 1000 link limit', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: 'active' }])
      return makeSelectChain([{ count: 1000 }])
    })
    const { canAddLink } = await import('./plan')
    expect(await canAddLink('user-1')).toBe(false)
  })
})

describe('canAddAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns true when free user has 0 automations', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: null }])
      return makeSelectChain([{ count: 0 }])
    })
    const { canAddAutomation } = await import('./plan')
    expect(await canAddAutomation('user-1')).toBe(true)
  })

  it('returns false when free user has 1 automation (at limit)', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: null }])
      return makeSelectChain([{ count: 1 }])
    })
    const { canAddAutomation } = await import('./plan')
    expect(await canAddAutomation('user-1')).toBe(false)
  })

  it('returns true for pro user with 19 automations', async () => {
    let callCount = 0
    mockSelect.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ subscriptionStatus: 'active' }])
      return makeSelectChain([{ count: 19 }])
    })
    const { canAddAutomation } = await import('./plan')
    expect(await canAddAutomation('user-1')).toBe(true)
  })
})

describe('isAnalyticsBreakdownAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns false for free user', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: null }]))
    const { isAnalyticsBreakdownAllowed } = await import('./plan')
    expect(await isAnalyticsBreakdownAllowed('user-1')).toBe(false)
  })

  it('returns true for pro user', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ subscriptionStatus: 'active' }]))
    const { isAnalyticsBreakdownAllowed } = await import('./plan')
    expect(await isAnalyticsBreakdownAllowed('user-1')).toBe(true)
  })
})

describe('getDailyDmsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('delegates to getDailyDmCount', async () => {
    const { getDailyDmsCount } = await import('./plan')
    const result = await getDailyDmsCount('user-1')
    expect(result).toBe(42)
  })
})
