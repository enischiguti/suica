import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from '~~/server/db/schema/users'

export const pageVisits = pgTable('page_visits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  visitedAt: timestamp('visited_at').notNull().defaultNow(),
  referrer: text('referrer'),
  device: text('device'),
  country: text('country'),
})
