import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { automationLogs, automations, instagramAccounts } from '~~/server/db/schema'
import { FREE_DAILY_DM_CAP, getDailyDmCount, msUntilNextUTCMidnight } from '~~/server/utils/dm-cap'
import { decryptToken } from '~~/server/utils/encryption'
import { createQueue, createWorker } from '~~/server/utils/queue'

export interface ProcessCommentJob {
  igAccountId: string
  commentId: string
  postId: string
  commenterUsername: string
  commentText: string
  commentedAt: string
}

const STALE_THRESHOLD_MS = 23 * 60 * 60 * 1000 + 55 * 60 * 1000

const graphApiResponseSchema = z.object({
  recipient_id: z.string().optional(),
  message_id: z.string().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
})

export async function processComment(data: ProcessCommentJob): Promise<void> {
  const { igAccountId, commentId, postId, commenterUsername, commentText, commentedAt } = data
  const db = useDB()

  // 1. Staleness check
  const commentAge = Date.now() - new Date(commentedAt).getTime()
  if (commentAge > STALE_THRESHOLD_MS) {
    await db.insert(automationLogs).values({
      id: crypto.randomUUID(),
      automationId: '',
      igCommentId: commentId,
      commenterUsername,
      status: 'dropped',
      error: 'Comment too old',
      triggeredAt: new Date(),
    })
    return
  }

  // 2. Dedup
  const existing = await db
    .select({ id: automationLogs.id })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.igCommentId, commentId),
        eq(automationLogs.status, 'sent'),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return
  }

  // 3. Fetch IG account
  const accountRows = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, igAccountId))
    .limit(1)

  const account = accountRows[0]
  if (!account) {
    return
  }

  const { userId, igUserId, accessToken: encryptedToken } = account
  const accessToken = decryptToken(encryptedToken)

  // 4. Load active automations ordered by priority
  const activeAutomations = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.igAccountId, igAccountId),
        eq(automations.isActive, true),
      ),
    )
    .orderBy(asc(automations.priority))

  // 5. Find first matching automation
  let matchedAutomation: typeof activeAutomations[number] | null = null
  for (const automation of activeAutomations) {
    const postMatches = automation.postIds.includes(postId)
    if (!postMatches) {
      continue
    }

    const keywords = automation.keywords
    const keywordMatches = !keywords || keywords.length === 0
      || keywords.some(kw => commentText.toLowerCase().includes(kw.toLowerCase()))

    if (keywordMatches) {
      matchedAutomation = automation
      break
    }
  }

  if (!matchedAutomation) {
    return
  }

  // 6. DM cap check
  const dmCount = await getDailyDmCount(userId)
  if (dmCount >= FREE_DAILY_DM_CAP) {
    const queue = createQueue<ProcessCommentJob>('process-comment')
    await queue.add('process-comment', data, { delay: msUntilNextUTCMidnight() })
    return
  }

  // 7. Send DM
  const message = matchedAutomation.message.replace(/\{\{username\}\}/g, commenterUsername)

  let sendError: string | null = null
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: igUserId },
        message: { text: message },
        access_token: accessToken,
      }),
    })
    const json: unknown = await res.json()
    const result = graphApiResponseSchema.safeParse(json)
    if (result.success && result.data.error) {
      sendError = result.data.error.message ?? 'Unknown error'
    }
  }
  catch (err) {
    sendError = err instanceof Error ? err.message : 'Unknown error'
  }

  // 8. Insert log
  await db.insert(automationLogs).values({
    id: crypto.randomUUID(),
    automationId: matchedAutomation.id,
    igCommentId: commentId,
    commenterUsername,
    status: sendError ? 'failed' : 'sent',
    error: sendError,
    triggeredAt: new Date(),
  })
}

export function createProcessCommentWorker() {
  return createWorker<ProcessCommentJob>('process-comment', job => processComment(job.data))
}
