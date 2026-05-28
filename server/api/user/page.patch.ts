import { defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { pageProfiles } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const bodySchema = z.object({
  bio: z.string().max(160).optional(),
  theme: z.enum(['default', 'midnight', 'rose', 'forest']).optional(),
  socials: z.array(z.object({
    platform: z.enum(['instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'github', 'website']),
    url: z.string().url(),
  })).max(7).optional(),
  customAvatarUrl: z.string().url().nullable().optional(),
})

export type UpdatePageBody = z.infer<typeof bodySchema>

export async function applyUpdatePage(userId: string, body: UpdatePageBody) {
  const db = useDB()

  const now = new Date()

  const rows = await db
    .insert(pageProfiles)
    .values({
      id: crypto.randomUUID(),
      userId,
      bio: body.bio,
      theme: body.theme ?? 'default',
      socials: body.socials,
      customAvatarUrl: body.customAvatarUrl,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pageProfiles.userId,
      set: {
        bio: body.bio,
        theme: body.theme,
        socials: body.socials,
        customAvatarUrl: body.customAvatarUrl,
        updatedAt: now,
      },
    })
    .returning()

  return rows[0]
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  return applyUpdatePage(session.user.id, body)
})
