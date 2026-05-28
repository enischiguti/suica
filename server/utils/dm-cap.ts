import { and, count, eq, gte } from 'drizzle-orm'
import { useDB } from '~~/server/db/index'
import { automationLogs, automations } from '~~/server/db/schema'

export const FREE_DAILY_DM_CAP = 100

export async function getDailyDmCount(userId: string): Promise<number> {
  const db = useDB()
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const result = await db
    .select({ count: count() })
    .from(automationLogs)
    .innerJoin(automations, eq(automationLogs.automationId, automations.id))
    .where(
      and(
        eq(automations.userId, userId),
        eq(automationLogs.status, 'sent'),
        gte(automationLogs.triggeredAt, utcMidnight),
      ),
    )

  return result[0]?.count ?? 0
}

export function msUntilNextUTCMidnight(): number {
  const now = new Date()
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return nextMidnight.getTime() - now.getTime()
}
