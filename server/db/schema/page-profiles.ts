import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from '~~/server/db/schema/users'

export const pageProfiles = pgTable('page_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  theme: text('theme').default('default'),
  socials: jsonb('socials'),
  customAvatarUrl: text('custom_avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
