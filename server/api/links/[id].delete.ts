import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id') ?? ''
  const db = useDB()

  const existing = await db.select().from(links).where(eq(links.id, id)).limit(1)
  const link = existing.find(l => l.id === id) ?? existing[0]

  if (!link) {
    throw createError({ statusCode: 404, message: 'Link not found' })
  }

  if (link.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await db.delete(links).where(eq(links.id, id))

  return { ok: true }
})
