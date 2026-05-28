import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { automations } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const updateAutomationSchema = z.object({
  name: z.string().min(1).optional(),
  igAccountId: z.string().optional(),
  postIds: z.array(z.string()).min(1).optional(),
  keywords: z.array(z.string()).optional(),
  message: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const paramsSchema = z.object({ id: z.string() })

export type UpdateAutomationBody = z.infer<typeof updateAutomationSchema>

export async function applyUpdateAutomation(automationId: string, userId: string, body: UpdateAutomationBody) {
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

  const updates: Partial<typeof automation> & { updatedAt: Date } = { updatedAt: new Date() }

  if (body.name !== undefined)
    updates.name = body.name
  if (body.igAccountId !== undefined)
    updates.igAccountId = body.igAccountId
  if (body.postIds !== undefined)
    updates.postIds = body.postIds
  if ('keywords' in body)
    updates.keywords = body.keywords ?? null
  if (body.message !== undefined)
    updates.message = body.message
  if (body.isActive !== undefined)
    updates.isActive = body.isActive
  if (body.priority !== undefined)
    updates.priority = body.priority

  const updated = await db
    .update(automations)
    .set(updates)
    .where(eq(automations.id, automationId))
    .returning()

  return updated[0]
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, updateAutomationSchema.parse)
  return applyUpdateAutomation(id, session.user.id, body)
})
