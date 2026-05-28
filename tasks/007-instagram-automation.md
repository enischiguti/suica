# 007 — Instagram automation

## Goal
Let users create automations that watch for comments on specific Instagram posts and auto-send a DM to the commenter. Users can configure multiple automations, each with: target posts, optional keyword filters, and a message template with `{{username}}` and an optional link. Automations are evaluated in priority order (top to bottom); the first matching one fires.

## Technical note — Instagram API
Login uses **Facebook OAuth** (Meta) for authentication. Instagram DM automation requires **separate Instagram Graph API access** via an Instagram Business or Creator account linked to a Facebook Page. After signup, users must connect their Instagram account through a dedicated OAuth step that grants `instagram_manage_messages` and `instagram_read_engaged_audience` permissions. This is a separate connection from the auth login.

## Specs

### DB schema — new tables

**`instagram_accounts` table** (`server/db/schema/instagram-accounts.ts`):
```
id              text  PK
userId          text  FK → users.id  UNIQUE
igUserId        text  not null  (Instagram user ID from Graph API)
igUsername      text  not null
accessToken     text  not null  (long-lived token, encrypted at rest)
tokenExpiresAt  timestamp
connectedAt     timestamp  defaultNow()
```

**`automations` table** (`server/db/schema/automations.ts`):
```
id            text  PK
userId        text  FK → users.id
igAccountId   text  FK → instagram_accounts.id
name          text  not null
postIds       text[]  not null  (Instagram post IDs to watch)
keywords      text[]  nullable  (if null/empty → match any comment)
message       text  not null  (supports {{username}} variable and one URL)
isActive      bool  default true
priority      int   not null  (lower = higher priority, enforced unique per user)
createdAt     timestamp  defaultNow()
updatedAt     timestamp  defaultNow()
```

**`automation_logs` table** (`server/db/schema/automation-logs.ts`):
```
id            text  PK
automationId  text  FK → automations.id
igCommentId   text  not null  (dedup key — indexed)
commenterUsername text
status        text  ('sent' | 'failed')
error         text  nullable
triggeredAt   timestamp  defaultNow()
```
Note: dedup is handled by querying `automation_logs` for the `igCommentId` before processing — no 'skipped' status needed since skipped comments produce no log row.

### Instagram account connection (`/app/automations/connect`)
- Button "Connect Instagram account" → redirects to `server/routes/instagram/connect.get.ts`
- Note: this is NOT a nuxt-auth-utils OAuth handler — it is a manual OAuth flow against Meta's API, kept under `/instagram/` to avoid clashing with `/auth/` routes used for login
- OAuth handler requests scopes: `instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `pages_messaging`
- On callback (`server/routes/instagram/callback.get.ts`):
  - Exchange code for short-lived token, then exchange for long-lived token (60-day)
  - Fetch Instagram user ID and username from Graph API
  - Upsert `instagram_accounts` row (encrypt `accessToken` with `ENCRYPTION_KEY` env var via Node `crypto.createCipheriv`)
  - Redirect to `/app/automations`
- Token refresh: schedule via BullMQ repeatable job to refresh tokens before expiry

### `/app/automations` — Automation manager page
- If no Instagram account connected: show a "Connect your Instagram" prompt card
- If connected: show connected account badge (avatar, `@username`, disconnect button)
- Automation list:
  - Drag-to-reorder (updates `priority` values on drop)
  - Each row: name, post count, keyword count, active toggle, edit/delete actions
  - "Add automation" button
- Empty state when no automations exist

### Create/Edit automation — slide-over or modal form
Fields:
- **Name**: text input
- **Instagram posts**: paste Instagram post URLs (one per line); the app extracts and stores the post ID
- **Keywords** (optional): tag input — comma or enter to add. Leave empty to match all comments.
- **Message**: textarea with character limit (1000). Toolbar shows `{{username}}` insert button and a "Insert link" button (opens a sub-picker to choose one of the user's su1.ca links)
- **Active**: toggle

### Comment processing — BullMQ worker
- Webhook receiver: `server/routes/webhooks/instagram.post.ts`
  - Verify Meta webhook signature (`X-Hub-Signature-256` header using `INSTAGRAM_WEBHOOK_SECRET` env var)
  - For each `comment` event: enqueue a `process-comment` BullMQ job
- Worker (`server/workers/process-comment.ts`):
  1. Load all active automations for the IG account, ordered by `priority ASC`
  2. Check `automation_logs` — if comment ID already processed, skip
  3. For each automation: check if `postId` matches AND (no keywords OR comment text contains at least one keyword, case-insensitive)
  4. First match: send DM via Graph API (`POST /{ig-user-id}/messages`), substituting `{{username}}` with the commenter's username
  5. Insert row in `automation_logs` with `status = 'sent'` or `'failed'`
  6. Stop after first match

### New environment variables
```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_WEBHOOK_SECRET=
ENCRYPTION_KEY=   # 32-byte hex string for AES-256 token encryption
```

### `/app/automations/logs` (optional sub-page)
- Table of recent `automation_logs` entries (last 100): automation name, commenter, status, timestamp
- Filter by automation, filter by status

## Acceptance criteria
- [ ] User can connect their Instagram Business/Creator account via OAuth
- [ ] Connected account is displayed with username; disconnecting removes the record
- [ ] User can create an automation with posts, optional keywords, and a message
- [ ] Automations can be reordered; priority persists to DB
- [ ] `{{username}}` in the message is replaced with the commenter's Instagram handle
- [ ] Webhook signature is verified before processing
- [ ] Each comment is only processed once (dedup via `automation_logs`)
- [ ] First matching automation fires; subsequent ones are skipped
- [ ] Failed DM sends are logged with the error message
- [ ] Access tokens are encrypted at rest
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
