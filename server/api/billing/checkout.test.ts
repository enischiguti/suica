import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Session mock ----
const mockRequireSession = vi.fn()

vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

// ---- DB mock ----
const mockSelect = vi.fn()
const mockUpdate = vi.fn()

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
    update: mockUpdate,
  })),
}))

// ---- Stripe mock ----
const mockCreateCustomer = vi.fn()
const mockCreateSession = vi.fn()

vi.mock('~~/server/utils/stripe', () => ({
  useStripe: vi.fn(() => ({
    customers: {
      create: mockCreateCustomer,
    },
    checkout: {
      sessions: {
        create: mockCreateSession,
      },
    },
  })),
}))

// ---- Runtime config ----
vi.stubGlobal('useRuntimeConfig', () => ({
  stripeMonthlyPriceId: 'price_monthly',
  stripeAnnualPriceId: 'price_annual',
  public: { baseUrl: 'http://localhost:3000' },
}))

// ---- h3 mock (default: monthly interval) ----
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readValidatedBody: vi.fn(async (_event: unknown, schema: (v: unknown) => unknown) =>
      schema({ interval: 'monthly' }),
    ),
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
  }
})

function makeEvent() {
  return {}
}

// eslint-disable-next-line ts/consistent-type-assertions
const handler = (await import('./checkout.post')).default as (event: unknown) => Promise<unknown>

describe('post /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUpdate.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })
  })

  it('creates checkout session and returns URL for existing customer', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockSelect.mockReturnValue(makeSelectChain([{
      id: 'user-1',
      email: 'user@example.com',
      stripeCustomerId: 'cus_existing',
    }]))
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session_123' })

    const result = await handler(makeEvent())

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session_123' })
    expect(mockCreateCustomer).not.toHaveBeenCalled()
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_existing',
      mode: 'subscription',
    }))
  })

  it('creates new Stripe customer when none exists', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockSelect.mockReturnValue(makeSelectChain([{
      id: 'user-1',
      email: 'user@example.com',
      stripeCustomerId: null,
    }]))
    mockCreateCustomer.mockResolvedValue({ id: 'cus_new' })
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/new_session' })

    const result = await handler(makeEvent())

    expect(result).toEqual({ url: 'https://checkout.stripe.com/new_session' })
    expect(mockCreateCustomer).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
    }))
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_new',
    }))
  })

  it('throws 401 when unauthenticated', async () => {
    mockRequireSession.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' })

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('uses annual price ID when interval is annual', async () => {
    const { readValidatedBody } = await import('h3')
    vi.mocked(readValidatedBody).mockImplementation(
      async (_event: unknown, schema: (v: unknown) => unknown) => schema({ interval: 'annual' }),
    )

    mockRequireSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockSelect.mockReturnValue(makeSelectChain([{
      id: 'user-1',
      email: 'user@example.com',
      stripeCustomerId: 'cus_existing',
    }]))
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/annual_session' })

    await handler(makeEvent())

    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: 'price_annual', quantity: 1 }],
    }))
  })
})
