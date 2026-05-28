import { eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { instagramAccounts } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export async function applyGetInstagramAccount(userId: string) {
  const db = useDB()
  const rows = await db
    .select({
      id: instagramAccounts.id,
      igUserId: instagramAccounts.igUserId,
      igUsername: instagramAccounts.igUsername,
      connectedAt: instagramAccounts.connectedAt,
    })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.userId, userId))
    .limit(1)

  return rows[0] ?? null
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return applyGetInstagramAccount(session.user.id)
})
