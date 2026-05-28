import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { isValidSlug } from '~~/server/utils/slug'

const updateLinkParamsSchema = z.object({ id: z.string() })

const updateLinkBodySchema = z.object({
  title: z.string().min(1).optional(),
  destinationUrl: z.string().url().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  showOnPage: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export interface UpdateLinkBody {
  title?: unknown
  destinationUrl?: unknown
  slug?: unknown
  showOnPage?: unknown
  isActive?: unknown
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export async function applyUpdateLink(
  linkId: string,
  userId: string,
  body: UpdateLinkBody,
) {
  const db = useDB()

  const existing = await db.select().from(links).where(eq(links.id, linkId)).limit(1)
  const link = existing.find(l => l.id === linkId) ?? existing[0]

  if (!link) {
    throw createError({ statusCode: 404, message: 'Link not found' })
  }

  if (link.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const updates: Partial<typeof link> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      throw createError({ statusCode: 400, message: 'Title cannot be empty' })
    }
    updates.title = body.title.trim()
  }

  if (body.destinationUrl !== undefined) {
    if (typeof body.destinationUrl !== 'string' || !isValidUrl(body.destinationUrl)) {
      throw createError({ statusCode: 400, message: 'A valid destination URL is required' })
    }
    updates.destinationUrl = body.destinationUrl
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || !isValidSlug(body.slug)) {
      throw createError({ statusCode: 400, message: 'Invalid slug format' })
    }

    if (body.slug !== link.slug) {
      const slugConflict = await db.select({ id: links.id })
        .from(links)
        .where(and(eq(links.userId, userId), eq(links.slug, body.slug)))
        .limit(1)

      if (slugConflict.length > 0) {
        throw createError({ statusCode: 409, message: 'Slug already in use' })
      }
    }

    updates.slug = body.slug
  }

  if (body.showOnPage !== undefined) {
    updates.showOnPage = body.showOnPage === true
  }

  if (body.isActive !== undefined) {
    updates.isActive = body.isActive === true
  }

  const updated = await db.update(links)
    .set(updates)
    .where(eq(links.id, linkId))
    .returning()

  return updated[0]
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { id } = await getValidatedRouterParams(event, updateLinkParamsSchema.parse)
  const body = await readValidatedBody(event, updateLinkBodySchema.parse)
  return applyUpdateLink(id, session.user.id, body)
})
