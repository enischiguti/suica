import { and, eq } from 'drizzle-orm'
import { defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { automations } from '~~/server/db/schema'
import { requireSession } from '~~/server/utils/session'

const reorderSchema = z.object({
  ids: z.array(z.string()),
})

export async function applyReorderAutomations(userId: string, ids: string[]) {
  const db = useDB()

  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      if (id) {
        await tx
          .update(automations)
          .set({ priority: i, updatedAt: new Date() })
          .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      }
    }
  })

  return { ok: true }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { ids } = await readValidatedBody(event, reorderSchema.parse)
  return applyReorderAutomations(session.user.id, ids)
})
