import type { H3Event } from 'h3'
import { count, desc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { useDB } from '~~/server/db/index'
import { linkClicks, links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export async function applyGetLinkStats(linkId: string, userId: string) {
  const db = useDB()

  const existing = await db.select({ id: links.id, userId: links.userId })
    .from(links)
    .where(eq(links.id, linkId))
    .limit(1)

  const found = existing[0]

  if (!found) {
    throw createError({ statusCode: 404, message: 'Link not found' })
  }

  if (found.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const totalRows = await db.select({ total: count() })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, linkId))
    .limit(1)

  const total = totalRows[0]?.total ?? 0

  const referrers = await db.select({ value: linkClicks.referrer, count: count() })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, linkId))
    .groupBy(linkClicks.referrer)
    .orderBy(desc(count()))
    .limit(5)

  const devices = await db.select({ value: linkClicks.device, count: count() })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, linkId))
    .groupBy(linkClicks.device)
    .orderBy(desc(count()))
    .limit(10)

  const countries = await db.select({ value: linkClicks.country, count: count() })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, linkId))
    .groupBy(linkClicks.country)
    .orderBy(desc(count()))
    .limit(5)

  return { total, referrers, devices, countries }
}

export default defineEventHandler(async (event: H3Event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  return applyGetLinkStats(id, session.user.id)
})
