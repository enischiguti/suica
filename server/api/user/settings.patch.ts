import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const body = await readBody(event)
  const { name } = body ?? {}

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Name must be a non-empty string' })
  }

  const trimmedName = name.trim()

  const updated = await useDB()
    .update(users)
    .set({ name: trimmedName, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning({ id: users.id, name: users.name, email: users.email })

  const user = updated[0]
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return { id: user.id, name: user.name, email: user.email }
})
