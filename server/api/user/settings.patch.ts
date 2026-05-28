import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const settingsSchema = z.object({
  name: z.string().trim().min(1),
})

export type SettingsBody = z.infer<typeof settingsSchema>

export async function applySettingsUpdate(userId: string, body: SettingsBody) {
  const trimmedName = body.name

  const updated = await useDB()
    .update(users)
    .set({ name: trimmedName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email })

  const user = updated[0]
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return { id: user.id, name: user.name, email: user.email }
}

export default defineEventHandler(async (event: H3Event) => {
  const session = await requireSession(event)
  const body = await readValidatedBody(event, settingsSchema.parse)
  return applySettingsUpdate(session.user.id, body)
})
