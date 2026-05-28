import { and, count, eq, max } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { automations, instagramAccounts } from '~~/server/db/schema'
import { canAddAutomation } from '~~/server/utils/plan'
import { requireSession } from '~~/server/utils/session'

const createAutomationSchema = z.object({
  name: z.string().min(1),
  igAccountId: z.string(),
  postIds: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
  message: z.string().min(1).max(1000),
  isActive: z.boolean().optional(),
})

export type CreateAutomationBody = z.infer<typeof createAutomationSchema>

export async function applyCreateAutomation(userId: string, body: CreateAutomationBody) {
  const db = useDB()

  // Plan enforcement
  const allowed = await canAddAutomation(userId)
  if (!allowed) {
    const countResult = await db.select({ count: count() }).from(automations).where(eq(automations.userId, userId))
    const current = countResult[0]?.count ?? 0
    throw createError({
      statusCode: 403,
      data: { code: 'LIMIT_REACHED', limit: 1, current },
    })
  }

  const igAccount = await db
    .select({ id: instagramAccounts.id })
    .from(instagramAccounts)
    .where(and(eq(instagramAccounts.id, body.igAccountId), eq(instagramAccounts.userId, userId)))
    .limit(1)

  if (!igAccount[0]) {
    throw createError({ statusCode: 400, message: 'Instagram account not found' })
  }

  const maxResult = await db
    .select({ maxPriority: max(automations.priority) })
    .from(automations)
    .where(eq(automations.userId, userId))

  const maxPriority = maxResult[0]?.maxPriority ?? -1
  const priority = maxPriority + 1

  const id = crypto.randomUUID()
  const now = new Date()

  const created = await db.insert(automations).values({
    id,
    userId,
    igAccountId: body.igAccountId,
    name: body.name,
    postIds: body.postIds,
    keywords: body.keywords ?? null,
    message: body.message,
    isActive: body.isActive ?? true,
    priority,
    createdAt: now,
    updatedAt: now,
  }).returning()

  const automation = created[0]
  if (!automation) {
    throw createError({ statusCode: 500, message: 'Failed to create automation' })
  }

  return automation
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readValidatedBody(event, createAutomationSchema.parse)
  return applyCreateAutomation(session.user.id, body)
})
