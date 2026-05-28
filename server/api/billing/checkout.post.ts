import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { useStripe } from '~~/server/utils/stripe'

const checkoutSchema = z.object({
  interval: z.enum(['monthly', 'annual']),
})

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { interval } = await readValidatedBody(event, checkoutSchema.parse)

  const db = useDB()
  const stripe = useStripe()
  const config = useRuntimeConfig()

  // Fetch user
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  const user = rows[0]
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id))
  }

  const priceId = interval === 'annual'
    ? config.stripeAnnualPriceId
    : config.stripeMonthlyPriceId

  const baseUrl = config.public.baseUrl

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/app/settings/billing?success=1`,
    cancel_url: `${baseUrl}/app/settings/billing`,
    allow_promotion_codes: true,
    metadata: { userId: user.id, interval },
  })

  return { url: checkoutSession.url }
})
