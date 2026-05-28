import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '~~/server/db/schema/users'

export const instagramAccounts = pgTable('instagram_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  igUserId: text('ig_user_id').notNull(),
  igUsername: text('ig_username').notNull(),
  accessToken: text('access_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
}, table => [uniqueIndex('instagram_accounts_user_id_idx').on(table.userId)])
