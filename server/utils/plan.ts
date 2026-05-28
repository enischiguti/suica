import { count, eq } from 'drizzle-orm'
import { useDB } from '~~/server/db/index'
import { automations, links, users } from '~~/server/db/schema'
import { getDailyDmCount } from '~~/server/utils/dm-cap'
import { PLANS } from '~~/shared/plans'

export async function getUserPlan(userId: string): Promise<'free' | 'pro'> {
  const db = useDB()
  const rows = await db
    .select({ subscriptionStatus: users.subscriptionStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const status = rows[0]?.subscriptionStatus
  if (status === 'active' || status === 'trialing') {
    return 'pro'
  }
  return 'free'
}

export async function canAddLink(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limit = PLANS[plan].limits.links

  const db = useDB()
  const result = await db
    .select({ count: count() })
    .from(links)
    .where(eq(links.userId, userId))

  const current = result[0]?.count ?? 0
  return current < limit
}

export async function canAddAutomation(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limit = PLANS[plan].limits.automations

  const db = useDB()
  const result = await db
    .select({ count: count() })
    .from(automations)
    .where(eq(automations.userId, userId))

  const current = result[0]?.count ?? 0
  return current < limit
}

export async function getDailyDmsCount(userId: string): Promise<number> {
  return getDailyDmCount(userId)
}

export async function isAnalyticsBreakdownAllowed(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  return plan === 'pro'
}
