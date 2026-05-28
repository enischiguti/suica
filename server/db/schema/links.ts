import { boolean, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '~~/server/db/schema/users'

export const links = pgTable('links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  destinationUrl: text('destination_url').notNull(),
  slug: text('slug').notNull(),
  showOnPage: boolean('show_on_page').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => [uniqueIndex('links_user_slug_idx').on(table.userId, table.slug)])
