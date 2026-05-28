import { count, desc, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { linkClicks, links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const db = useDB()

  const rows = await db
    .select({
      id: links.id,
      title: links.title,
      destinationUrl: links.destinationUrl,
      slug: links.slug,
      showOnPage: links.showOnPage,
      isActive: links.isActive,
      createdAt: links.createdAt,
      clickCount: count(linkClicks.id),
    })
    .from(links)
    .leftJoin(linkClicks, eq(linkClicks.linkId, links.id))
    .where(eq(links.userId, session.user.id))
    .groupBy(links.id)
    .orderBy(desc(links.createdAt))

  return rows
})
