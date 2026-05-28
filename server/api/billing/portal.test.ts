import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Session mock ----
const mockRequireSession = vi.fn()

vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

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

// ---- Stripe mock ----
const mockCreatePortalSession = vi.fn()

vi.mock('~~/server/utils/stripe', () => ({
  useStripe: vi.fn(() => ({
    billingPortal: {
      sessions: {
        create: mockCreatePortalSession,
      },
    },
  })),
}))

// ---- Runtime config ----
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { baseUrl: 'http://localhost:3000' },
}))

// ---- h3 mock ----
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
  }
})

function makeEvent() {
  return {}
}

// eslint-disable-next-line ts/consistent-type-assertions
const handler = (await import('./portal.post')).default as (event: unknown) => Promise<unknown>

describe('post /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates portal session and returns URL', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_123' }]))
    mockCreatePortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/session_abc' })

    const result = await handler(makeEvent())

    expect(result).toEqual({ url: 'https://billing.stripe.com/session_abc' })
    expect(mockCreatePortalSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_123',
      return_url: 'http://localhost:3000/app/settings/billing',
    }))
  })

  it('throws 400 when user has no stripeCustomerId', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]))

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 401 when unauthenticated', async () => {
    mockRequireSession.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' })

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})
