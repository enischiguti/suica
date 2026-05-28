import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readRawBody } from 'h3'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { useStripe } from '~~/server/utils/stripe'

function getPriceInterval(priceId: string, config: { stripeMonthlyPriceId: string, stripeAnnualPriceId: string }): string {
  if (priceId === config.stripeAnnualPriceId)
    return 'annual'
  return 'monthly'
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, false)
  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody ?? '', 'utf8')

  const signature = event.headers.get('stripe-signature') ?? ''
  const config = useRuntimeConfig()
  const stripe = useStripe()

  let stripeEvent: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      bodyBuffer,
      signature,
      config.stripeWebhookSecret,
    )
  }
  catch {
    throw createError({ statusCode: 401, message: 'Invalid Stripe signature' })
  }

  const db = useDB()

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

    if (!customerId || !subscriptionId)
      return { ok: true }

    // Fetch subscription to get price
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0]?.price.id ?? ''
    const interval = getPriceInterval(priceId, config)

    await db
      .update(users)
      .set({
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        billingInterval: interval,
        subscriptionStatus: 'active',
      })
      .where(eq(users.stripeCustomerId, customerId))
  }
  else if (stripeEvent.type === 'customer.subscription.updated') {
    const subscription = stripeEvent.data.object
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    const priceId = subscription.items.data[0]?.price.id ?? ''
    const interval = getPriceInterval(priceId, config)

    await db
      .update(users)
      .set({
        subscriptionStatus: subscription.status,
        stripePriceId: priceId,
        billingInterval: interval,
      })
      .where(eq(users.stripeCustomerId, customerId))
  }
  else if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

    await db
      .update(users)
      .set({
        subscriptionStatus: 'canceled',
        stripePriceId: null,
        stripeSubscriptionId: null,
      })
      .where(eq(users.stripeCustomerId, customerId))
  }
  else if (stripeEvent.type === 'invoice.payment_failed') {
    const invoice = stripeEvent.data.object
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

    if (customerId) {
      await db
        .update(users)
        .set({ subscriptionStatus: 'past_due' })
        .where(eq(users.stripeCustomerId, customerId))
    }
  }

  return { ok: true }
})
