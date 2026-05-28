import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { links, pageProfiles, users } from '~~/server/db/schema'

const paramsSchema = z.object({ username: z.string() })

export async function applyGetPublicProfile(username: string) {
  const db = useDB()

  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      userUsername: users.username,
      userAvatarUrl: users.avatarUrl,
      bio: pageProfiles.bio,
      theme: pageProfiles.theme,
      socials: pageProfiles.socials,
      customAvatarUrl: pageProfiles.customAvatarUrl,
    })
    .from(users)
    .leftJoin(pageProfiles, eq(pageProfiles.userId, users.id))
    .where(eq(users.username, username))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const pageLinks = await db
    .select({
      id: links.id,
      title: links.title,
      destinationUrl: links.destinationUrl,
      slug: links.slug,
      showOnPage: links.showOnPage,
      isActive: links.isActive,
      createdAt: links.createdAt,
    })
    .from(links)
    .where(
      eq(links.userId, row.userId),
    )
    .orderBy(links.createdAt)

  const activeLinks = pageLinks.filter(l => l.showOnPage && l.isActive)

  const effectiveAvatarUrl = row.customAvatarUrl ?? row.userAvatarUrl

  return {
    user: {
      name: row.userName,
      username: row.userUsername,
      avatarUrl: row.userAvatarUrl,
    },
    profile: {
      bio: row.bio,
      theme: row.theme,
      socials: row.socials,
      customAvatarUrl: row.customAvatarUrl,
      effectiveAvatarUrl,
    },
    links: activeLinks,
  }
}

export default defineEventHandler(async (event) => {
  const { username } = await getValidatedRouterParams(event, paramsSchema.parse)
  return applyGetPublicProfile(username)
})
