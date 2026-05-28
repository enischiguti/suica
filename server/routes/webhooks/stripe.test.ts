import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- DB mock ----
let lastSetData: Record<string, unknown> | null = null

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    update: vi.fn((_table: unknown) => ({
      set: (data: Record<string, unknown>) => {
        lastSetData = data
        return {
          where: vi.fn(() => Promise.resolve()),
        }
      },
    })),
  })),
}))

// ---- Stripe mock ----
const mockConstructEvent = vi.fn()
const mockRetrieveSubscription = vi.fn()

vi.mock('~~/server/utils/stripe', () => ({
  useStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockRetrieveSubscription,
    },
  })),
}))

// ---- Runtime config ----
vi.stubGlobal('useRuntimeConfig', () => ({
  stripeWebhookSecret: 'whsec_test',
  stripeMonthlyPriceId: 'price_monthly',
  stripeAnnualPriceId: 'price_annual',
  public: { baseUrl: 'http://localhost:3000' },
}))

// ---- h3 mock ----
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readRawBody: vi.fn(async () => Buffer.from('{}', 'utf8')),
    createError: actual.createError,
    defineEventHandler: (fn: (event: unknown) => unknown) => fn,
  }
})

function makeEvent(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
  }
}

// eslint-disable-next-line ts/consistent-type-assertions
const handler = (await import('./stripe.post')).default as (event: unknown) => Promise<unknown>

describe('stripe webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    lastSetData = null
  })

  it('handles checkout.session.completed and updates user to active', async () => {
    const subscriptionData = {
      id: 'sub_123',
      items: { data: [{ price: { id: 'price_monthly' } }] },
    }

    mockRetrieveSubscription.mockResolvedValue(subscriptionData)
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })

    const result = await handler(makeEvent({ 'stripe-signature': 'sig_test' }))

    expect(result).toEqual({ ok: true })
    expect(lastSetData).toMatchObject({
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_monthly',
      billingInterval: 'monthly',
      subscriptionStatus: 'active',
    })
  })

  it('handles checkout.session.completed with annual price', async () => {
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_annual',
      items: { data: [{ price: { id: 'price_annual' } }] },
    })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_456',
          subscription: 'sub_annual',
        },
      },
    })

    await handler(makeEvent({ 'stripe-signature': 'sig_test' }))

    expect(lastSetData).toMatchObject({
      billingInterval: 'annual',
      subscriptionStatus: 'active',
    })
  })

  it('handles customer.subscription.updated', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_monthly' } }] },
        },
      },
    })

    await handler(makeEvent({ 'stripe-signature': 'sig_test' }))

    expect(lastSetData).toMatchObject({
      subscriptionStatus: 'active',
      stripePriceId: 'price_monthly',
      billingInterval: 'monthly',
    })
  })

  it('handles customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_123',
          status: 'canceled',
          items: { data: [] },
        },
      },
    })

    await handler(makeEvent({ 'stripe-signature': 'sig_test' }))

    expect(lastSetData).toMatchObject({
      subscriptionStatus: 'canceled',
      stripePriceId: null,
    })
  })

  it('handles invoice.payment_failed', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          customer: 'cus_123',
        },
      },
    })

    await handler(makeEvent({ 'stripe-signature': 'sig_test' }))

    expect(lastSetData).toMatchObject({
      subscriptionStatus: 'past_due',
    })
  })

  it('throws 401 on invalid Stripe signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    await expect(handler(makeEvent({ 'stripe-signature': 'bad_sig' }))).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})
