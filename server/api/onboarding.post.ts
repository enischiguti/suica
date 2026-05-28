import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { isReservedUsername } from '~/utils/username'

const onboardingSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/),
  useCase: z.enum(['personal-page', 'instagram-automation']),
})

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const { username, useCase } = await readValidatedBody(event, onboardingSchema.parse)

  if (isReservedUsername(username)) {
    throw createError({ statusCode: 400, message: 'Username not available' })
  }

  // Race condition guard: check if username is taken
  const existing = await useDB().query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.username, username),
  })

  if (existing) {
    throw createError({ statusCode: 400, message: 'Username not available' })
  }

  await useDB().update(users).set({ username, useCase }).where(eq(users.id, session.user.id))

  return { ok: true }
})
