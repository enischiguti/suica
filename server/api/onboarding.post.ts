import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { useDB } from '~~/server/db/index'
import { users } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { isReservedUsername, isValidUsernameFormat } from '~/utils/username'

type UseCase = 'personal-page' | 'instagram-automation'

function isValidUseCase(value: unknown): value is UseCase {
  return value === 'personal-page' || value === 'instagram-automation'
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const body = await readBody(event)
  const { username, useCase } = body ?? {}

  if (typeof username !== 'string' || !isValidUsernameFormat(username)) {
    throw createError({ statusCode: 400, message: 'Invalid username format' })
  }

  if (isReservedUsername(username)) {
    throw createError({ statusCode: 400, message: 'Username not available' })
  }

  if (!isValidUseCase(useCase)) {
    throw createError({ statusCode: 400, message: 'Invalid use case' })
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
