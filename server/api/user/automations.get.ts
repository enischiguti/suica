import { asc, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDB } from '~~/server/db/index'
import { automations } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

export async function applyGetAutomations(userId: string) {
  const db = useDB()
  return db
    .select()
    .from(automations)
    .where(eq(automations.userId, userId))
    .orderBy(asc(automations.priority))
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return applyGetAutomations(session.user.id)
})
