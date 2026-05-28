import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { links } from '~~/server/db/schema/links'

export const linkClicks = pgTable('link_clicks', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  clickedAt: timestamp('clicked_at').notNull().defaultNow(),
  referrer: text('referrer'),
  device: text('device'),
  country: text('country'),
})
