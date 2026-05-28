import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUserPlan = vi.fn(async () => 'free')
const mockGetDailyDmsCount = vi.fn(async () => 5)

vi.mock('~~/server/utils/plan', () => ({
  getUserPlan: mockGetUserPlan,
  getDailyDmsCount: mockGetDailyDmsCount,
}))

const mockSelectRows = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({ select: mockSelectRows })),
}))

function makeSelectChain(data: unknown[]) {
  const resolved = Promise.resolve(data)
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => resolved),
    orderBy: vi.fn(() => resolved),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  }
  return chain
}

const { applyGetBilling } = await import('./billing.get')

describe('applyGetBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserPlan.mockResolvedValue('free')
    mockGetDailyDmsCount.mockResolvedValue(5)
  })

  it('returns free plan with usage for a free user', async () => {
    let callCount = 0
    mockSelectRows.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ count: 3 }])
      if (idx === 1)
        return makeSelectChain([{ count: 0 }])
      return makeSelectChain([])
    })

    const result = await applyGetBilling('user-1')

    expect(result).toMatchObject({
      plan: 'free',
      usage: { links: 3, automations: 0, dmsToday: 5 },
    })
    expect(result.subscription).toBeUndefined()
  })

  it('returns pro plan with subscription info for a pro user', async () => {
    mockGetUserPlan.mockResolvedValue('pro')

    let callCount = 0
    mockSelectRows.mockImplementation(() => {
      const idx = callCount++
      if (idx === 0)
        return makeSelectChain([{ count: 50 }])
      if (idx === 1)
        return makeSelectChain([{ count: 5 }])
      if (idx === 2) {
        return makeSelectChain([{
          subscriptionStatus: 'active',
          billingInterval: 'monthly',
          stripeSubscriptionId: null,
        }])
      }
      return makeSelectChain([])
    })

    const result = await applyGetBilling('user-1')

    expect(result).toMatchObject({
      plan: 'pro',
      usage: { links: 50, automations: 5 },
      subscription: { status: 'active', interval: 'monthly' },
    })
  })

  it('returns zero counts when user has no links or automations', async () => {
    mockSelectRows.mockReturnValue(makeSelectChain([{ count: 0 }]))

    const result = await applyGetBilling('user-1')

    expect(result).toMatchObject({
      plan: 'free',
      usage: { links: 0, automations: 0, dmsToday: 5 },
    })
  })
})
