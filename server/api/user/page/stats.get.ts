import { count, desc, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { pageVisits } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export async function applyGetPageStats(userId: string) {
  const db = useDB()

  // Total count
  const totalRows = await db
    .select({ count: count() })
    .from(pageVisits)
    .where(eq(pageVisits.userId, userId))

  const total = totalRows[0]?.count ?? 0

  // Referrers top 5
  const referrerRows = await db
    .select({ value: pageVisits.referrer, count: count() })
    .from(pageVisits)
    .where(eq(pageVisits.userId, userId))
    .groupBy(pageVisits.referrer)
    .orderBy(desc(count()))
    .limit(5)

  // Devices breakdown
  const deviceRows = await db
    .select({ value: pageVisits.device, count: count() })
    .from(pageVisits)
    .where(eq(pageVisits.userId, userId))
    .groupBy(pageVisits.device)
    .orderBy(desc(count()))

  // Countries top 5
  const countryRows = await db
    .select({ value: pageVisits.country, count: count() })
    .from(pageVisits)
    .where(eq(pageVisits.userId, userId))
    .groupBy(pageVisits.country)
    .orderBy(desc(count()))
    .limit(5)

  return {
    total,
    referrers: referrerRows,
    devices: deviceRows,
    countries: countryRows,
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return applyGetPageStats(session.user.id)
})
