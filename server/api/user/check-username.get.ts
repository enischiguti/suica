import { defineEventHandler, getValidatedQuery } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { requireSession } from '~~/server/utils/session'
import { isReservedUsername, isValidUsernameFormat } from '~/utils/username'

export default defineEventHandler(async (event) => {
  await requireSession(event)

  const query = await getValidatedQuery(event, z.object({ username: z.string() }).parse)
  const { username } = query

  if (!isValidUsernameFormat(username)) {
    return { available: false }
  }

  if (isReservedUsername(username)) {
    return { available: false }
  }

  const existing = await useDB().query.users.findFirst({
    where: (u, { eq }) => eq(u.username, username),
  })

  return { available: !existing }
})
