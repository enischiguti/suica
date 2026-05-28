import { count, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { automations, links, users } from '~~/server/db/schema'
import { getDailyDmsCount, getUserPlan } from '~~/server/utils/plan'
import { requireSession } from '~~/server/utils/session'

export async function applyGetBilling(userId: string) {
  const db = useDB()

  const [plan, linksResult, automationsResult, dmsToday] = await Promise.all([
    getUserPlan(userId),
    db.select({ count: count() }).from(links).where(eq(links.userId, userId)),
    db.select({ count: count() }).from(automations).where(eq(automations.userId, userId)),
    getDailyDmsCount(userId),
  ])

  const linksCount = linksResult[0]?.count ?? 0
  const automationsCount = automationsResult[0]?.count ?? 0

  // Fetch subscription info for pro users
  let subscription: { status: string, interval: string, renewalDate: string | null } | undefined

  if (plan === 'pro') {
    const userRows = await db
      .select({
        subscriptionStatus: users.subscriptionStatus,
        billingInterval: users.billingInterval,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const userRow = userRows[0]
    if (userRow) {
      let renewalDate: string | null = null

      if (userRow.stripeSubscriptionId) {
        try {
          const stripe = (await import('~~/server/utils/stripe')).useStripe()
          const sub = await stripe.subscriptions.retrieve(userRow.stripeSubscriptionId)
          renewalDate = new Date(sub.current_period_end * 1000).toISOString()
        }
        catch {
          // ignore if stripe call fails
        }
      }

      subscription = {
        status: userRow.subscriptionStatus ?? 'active',
        interval: userRow.billingInterval ?? 'monthly',
        renewalDate,
      }
    }
  }

  return {
    plan,
    usage: {
      links: linksCount,
      automations: automationsCount,
      dmsToday,
    },
    subscription,
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return applyGetBilling(session.user.id)
})
