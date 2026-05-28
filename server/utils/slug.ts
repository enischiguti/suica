import { and, eq } from 'drizzle-orm'
import { useDB } from '~~/server/db/index'
import { links } from '~~/server/db/schema'

/**
 * Generate a slug from a title: lowercase, spaces→hyphens,
 * strip non-alphanumeric except hyphens, max 60 chars.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60)
}

/**
 * Check if a slug is valid for use as a custom slug.
 * Must match /^[a-z0-9-]+$/ and be 1–64 chars long.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 64
}

function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * Generate a unique slug for a user.
 * Checks DB for collisions, appends 4-char random suffix if needed.
 * Tries up to 5 times before throwing.
 */
export async function generateUniqueSlug(title: string, userId: string): Promise<string> {
  const base = slugify(title) || 'link'
  const db = useDB()

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 55)}-${randomSuffix()}`

    const existing = await db.select({ id: links.id })
      .from(links)
      .where(and(eq(links.userId, userId), eq(links.slug, candidate)))
      .limit(1)

    if (existing.length === 0) {
      return candidate
    }
  }

  throw new Error('Could not generate a unique slug after 5 attempts')
}
