import { eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { instagramAccounts } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export async function applyDeleteInstagramAccount(userId: string) {
  const db = useDB()
  await db.delete(instagramAccounts).where(eq(instagramAccounts.userId, userId))
  return { ok: true }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return applyDeleteInstagramAccount(session.user.id)
})
