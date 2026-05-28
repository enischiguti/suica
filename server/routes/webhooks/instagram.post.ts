import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readRawBody } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { instagramAccounts } from '~~/server/db/schema'
import { createQueue } from '~~/server/utils/queue'

export function verifyWebhookSignature(body: Buffer, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) {
    return false
  }
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  }
  catch {
    return false
  }
}

const webhookPayloadSchema = z.object({
  entry: z.array(z.object({
    id: z.string().optional(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        comment_id: z.string(),
        post_id: z.string(),
        from: z.object({ username: z.string().optional(), id: z.string().optional() }).optional(),
        message: z.string().optional(),
        timestamp: z.number().optional(),
      }).optional(),
    })).optional(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, false)
  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody ?? '', 'utf8')

  const signature = event.headers.get('x-hub-signature-256') ?? ''
  const config = useRuntimeConfig()

  if (!verifyWebhookSignature(bodyBuffer, signature, config.instagramWebhookSecret)) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  const parsed = webhookPayloadSchema.safeParse(JSON.parse(bodyBuffer.toString('utf8')))
  const payload = parsed.success ? parsed.data : { entry: [] }
  const db = useDB()
  const queue = createQueue<ProcessCommentJob>('process-comment')

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments' || !change.value) {
        continue
      }

      const value = change.value
      const { comment_id: commentId, post_id: postId } = value
      const commenterUsername = value.from?.username ?? ''
      const commentText = value.message ?? ''
      const timestamp = value.timestamp ?? 0

      // Find igAccount by entry id (page/account id)
      const accountRows = await db
        .select({ id: instagramAccounts.id })
        .from(instagramAccounts)
        .where(eq(instagramAccounts.igUserId, entry.id ?? ''))
        .limit(1)

      const igAccountId = accountRows[0]?.id
      if (!igAccountId) {
        continue
      }

      await queue.add('process-comment', {
        igAccountId,
        commentId,
        postId,
        commenterUsername,
        commentText,
        commentedAt: new Date(timestamp * 1000).toISOString(),
      })
    }
  }

  return { ok: true }
})

export interface ProcessCommentJob {
  igAccountId: string
  commentId: string
  postId: string
  commenterUsername: string
  commentText: string
  commentedAt: string
}
