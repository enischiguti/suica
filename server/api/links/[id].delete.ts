import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const deleteParamsSchema = z.object({ id: z.string() })

export async function applyDeleteLink(linkId: string, userId: string) {
  const db = useDB()

  const existing = await db.select({ id: links.id, userId: links.userId })
    .from(links)
    .where(eq(links.id, linkId))
    .limit(1)

  const link = existing[0]

  if (!link) {
    throw createError({ statusCode: 404, message: 'Link not found' })
  }

  if (link.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await db.delete(links).where(eq(links.id, linkId))

  return { ok: true }
}

export default defineEventHandler(async (event: H3Event) => {
  const session = await requireSession(event)
  const { id } = await getValidatedRouterParams(event, deleteParamsSchema.parse)
  return applyDeleteLink(id, session.user.id)
})
