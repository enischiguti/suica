import { createHash } from 'node:crypto'
import { useRedis } from '~~/server/utils/queue'

export interface RecordVisitOptions {
  key: string
  ip: string
  insert: () => Promise<void>
  ttlSeconds?: number
}

export async function recordVisit(options: RecordVisitOptions): Promise<void> {
  const { key, ip, insert, ttlSeconds = 3600 } = options

  const salt = useRuntimeConfig().analyticsSecret
  const date = new Date().toISOString().slice(0, 10) // e.g. "2025-01-15"
  const dailySalt = createHash('sha256').update(salt + date).digest('hex')
  const hash = createHash('sha256').update(`${ip}:${dailySalt}`).digest('hex')

  const redisKey = `dedup:${key}:${hash}`
  const redis = useRedis()
  const result = await redis.set(redisKey, '1', 'EX', ttlSeconds, 'NX')

  if (result === null) {
    // Already recorded for this IP today — skip
    return
  }

  await insert()
}
