import { and, eq } from 'drizzle-orm'

import { createError, defineEventHandler, readBody } from 'h3'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'
import { generateUniqueSlug, isValidSlug } from '~~/server/utils/slug'

export interface CreateLinkBody {
  title: unknown
  destinationUrl: unknown
  slug?: unknown
  showOnPage?: unknown
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

export async function applyCreateLink(userId: string, body: CreateLinkBody) {
  const { title, destinationUrl, slug, showOnPage } = body

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'Title is required' })
  }

  if (typeof destinationUrl !== 'string' || !isValidUrl(destinationUrl)) {
    throw createError({ statusCode: 400, message: 'A valid destination URL is required' })
  }

  const db = useDB()
  let resolvedSlug: string

  if (slug !== undefined && slug !== '') {
    if (typeof slug !== 'string' || !isValidSlug(slug)) {
      throw createError({ statusCode: 400, message: 'Invalid slug format' })
    }

    const existing = await db.select({ id: links.id })
      .from(links)
      .where(and(eq(links.userId, userId), eq(links.slug, slug)))
      .limit(1)

    if (existing.length > 0) {
      throw createError({ statusCode: 409, message: 'Slug already in use' })
    }

    resolvedSlug = slug
  }
  else {
    resolvedSlug = await generateUniqueSlug(title.trim(), userId)
  }

  const id = crypto.randomUUID()
  const now = new Date()

  const created = await db.insert(links).values({
    id,
    userId,
    title: title.trim(),
    destinationUrl,
    slug: resolvedSlug,
    showOnPage: showOnPage === true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).returning()

  const link = created[0]
  if (!link) {
    throw createError({ statusCode: 500, message: 'Failed to create link' })
  }

  return link
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody<CreateLinkBody>(event)
  return applyCreateLink(session.user.id, body ?? {})
})
