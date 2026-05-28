import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { automations } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const paramsSchema = z.object({ id: z.string() })

export async function applyDeleteAutomation(automationId: string, userId: string) {
  const db = useDB()

  const existing = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1)

  const automation = existing[0]
  if (!automation) {
    throw createError({ statusCode: 404, message: 'Automation not found' })
  }

  if (automation.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await db.delete(automations).where(eq(automations.id, automationId))
  return { ok: true }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  return applyDeleteAutomation(id, session.user.id)
})
