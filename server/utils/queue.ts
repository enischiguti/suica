import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

let _redis: IORedis | null = null

export function useRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(useRuntimeConfig().redisUrl, {
      maxRetriesPerRequest: null,
    })
  }
  return _redis
}

export function createQueue<T = unknown>(name: string) {
  return new Queue<T>(name, { connection: useRedis() })
}

export function createWorker<T = unknown>(
  name: string,
  processor: ConstructorParameters<typeof Worker<T>>[1],
) {
  return new Worker<T>(name, processor, { connection: useRedis() })
}
