import { and, count, eq } from 'drizzle-orm'

import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'
import { canAddLink, getUserPlan } from '~~/server/utils/plan'
import { requireSession } from '~~/server/utils/session'
import { generateUniqueSlug, isValidSlug } from '~~/server/utils/slug'
import { PLANS } from '~~/shared/plans'

const createLinkSchema = z.object({
  title: z.string().min(1),
  destinationUrl: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(64).optional(),
  showOnPage: z.boolean().optional(),
})

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

  // Plan enforcement
  const allowed = await canAddLink(userId)
  if (!allowed) {
    const plan = await getUserPlan(userId)
    const limit = PLANS[plan].limits.links
    const db = useDB()
    const countResult = await db.select({ count: count() }).from(links).where(eq(links.userId, userId))
    const current = countResult[0]?.count ?? 0
    throw createError({
      statusCode: 403,
      data: { code: 'LIMIT_REACHED', limit, current },
    })
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
  const body = await readValidatedBody(event, createLinkSchema.parse)
  return applyCreateLink(session.user.id, body)
})
