import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRequestHeader, getRequestIP, getValidatedRouterParams } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { pageVisits, users } from '~~/server/db/schema'
import { recordVisit } from '~~/server/utils/analytics'
import { detectDevice } from '~~/server/utils/device'

const paramsSchema = z.object({ username: z.string() })

export interface VisitContext {
  ip: string
  referrer: string | null
  userAgent: string
  country: string | null
}

export async function applyRecordPageVisit(username: string, ctx: VisitContext): Promise<void> {
  const db = useDB()

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  const user = rows[0]
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const device = detectDevice(ctx.userAgent)

  await recordVisit({
    key: `page:${user.id}`,
    ip: ctx.ip,
    insert: async () => {
      await useDB().insert(pageVisits).values({
        id: crypto.randomUUID(),
        userId: user.id,
        referrer: ctx.referrer,
        device,
        country: ctx.country,
      })
    },
  })
}

export default defineEventHandler(async (event) => {
  const { username } = await getValidatedRouterParams(event, paramsSchema.parse)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? '0.0.0.0'
  const referrer = getRequestHeader(event, 'referer') ?? null
  const userAgent = getRequestHeader(event, 'user-agent') ?? ''
  const country = getRequestHeader(event, 'cf-ipcountry') ?? getRequestHeader(event, 'x-vercel-ip-country') ?? null

  await applyRecordPageVisit(username, { ip, referrer, userAgent, country })

  return { ok: true }
})
