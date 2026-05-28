import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { useStripe } from '~~/server/utils/stripe'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const db = useDB()
  const stripe = useStripe()
  const config = useRuntimeConfig()

  const rows = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  const user = rows[0]
  if (!user?.stripeCustomerId) {
    throw createError({ statusCode: 400, message: 'No Stripe customer found' })
  }

  const baseUrl = config.public.baseUrl

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/app/settings/billing`,
  })

  return { url: portalSession.url }
})
