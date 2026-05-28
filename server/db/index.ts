import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDB() {
  if (!_db) {
    const client = postgres(useRuntimeConfig().databaseUrl)
    _db = drizzle(client, { schema })
  }
  return _db
}
