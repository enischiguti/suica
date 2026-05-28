import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { instagramAccounts } from '~~/server/db/schema/instagram-accounts'
import { users } from '~~/server/db/schema/users'

export const automations = pgTable('automations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  igAccountId: text('ig_account_id').notNull().references(() => instagramAccounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  postIds: text('post_ids').array().notNull(),
  keywords: text('keywords').array(),
  message: text('message').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
