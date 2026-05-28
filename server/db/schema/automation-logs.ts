import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { automations } from '~~/server/db/schema/automations'

export const automationLogs = pgTable('automation_logs', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').references(() => automations.id, { onDelete: 'cascade' }),
  igCommentId: text('ig_comment_id').notNull(),
  commenterUsername: text('commenter_username'),
  status: text('status').notNull(),
  error: text('error'),
  triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
}, table => [index('automation_logs_ig_comment_id_idx').on(table.igCommentId)])
