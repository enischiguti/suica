import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRequestHeader, getRequestIP, sendRedirect } from 'h3'
import { useDB } from '~~/server/db/index'
import { linkClicks, links, users } from '~~/server/db/schema'
import { recordVisit } from '~~/server/utils/analytics'
import { detectDevice } from '~~/server/utils/device'

export interface ClickContext {
  ip: string
  referrer: string | null
  userAgent: string
  country: string | null
}

export async function applyRedirect(
  username: string,
  slug: string,
  clickContext: ClickContext,
) {
  const db = useDB()

  const rows = await db
    .select({
      id: links.id,
      destinationUrl: links.destinationUrl,
    })
    .from(links)
    .innerJoin(users, eq(links.userId, users.id))
    .where(
      and(
        eq(users.username, username),
        eq(links.slug, slug),
        eq(links.isActive, true),
      ),
    )
    .limit(1)

  const link = rows[0]
  if (!link) {
    throw createError({ statusCode: 404 })
  }

  recordVisit({
    key: `link:${link.id}`,
    ip: clickContext.ip,
    insert: async () => {
      await useDB().insert(linkClicks).values({
        id: crypto.randomUUID(),
        linkId: link.id,
        referrer: clickContext.referrer,
        device: detectDevice(clickContext.userAgent),
        country: clickContext.country,
      })
    },
  }).catch(console.error)

  return link.destinationUrl
}

export default defineEventHandler(async (event) => {
  const username = event.context.params?.username ?? ''
  const slug = event.context.params?.slug ?? ''

  const clickContext: ClickContext = {
    ip: getRequestIP(event, { xForwardedFor: true }) ?? '',
    referrer: getRequestHeader(event, 'referer') ?? null,
    userAgent: getRequestHeader(event, 'user-agent') ?? '',
    country: getRequestHeader(event, 'cf-ipcountry') ?? getRequestHeader(event, 'x-vercel-ip-country') ?? null,
  }

  const destinationUrl = await applyRedirect(username, slug, clickContext)
  return sendRedirect(event, destinationUrl, 302)
})
