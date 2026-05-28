import { count, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { useDB } from '~~/server/db/index'
import { linkClicks, links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  const db = useDB()

  const existing = await db.select({ id: links.id, userId: links.userId })
    .from(links)
    .where(eq(links.id, id))
    .limit(1)

  const found = existing[0]

  if (!found) {
    throw createError({ statusCode: 404, message: 'Link not found' })
  }

  if (found.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const totalRows = await db.select({ total: count() })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, id))

  const total = totalRows[0]?.total ?? 0

  const referrerRows = await db.select({
    value: linkClicks.referrer,
    count: count(),
  })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, id))
    .groupBy(linkClicks.referrer)
    .orderBy(count())
    .limit(5)

  const deviceRows = await db.select({
    value: linkClicks.device,
    count: count(),
  })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, id))
    .groupBy(linkClicks.device)
    .orderBy(count())

  const countryRows = await db.select({
    value: linkClicks.country,
    count: count(),
  })
    .from(linkClicks)
    .where(eq(linkClicks.linkId, id))
    .groupBy(linkClicks.country)
    .orderBy(count())
    .limit(5)

  return {
    total,
    referrers: referrerRows,
    devices: deviceRows,
    countries: countryRows,
  }
})
