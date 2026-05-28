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
Statuses: `sent` | `failed` | `dropped` (see worker section). Dedup is handled by querying `automation_logs` for `igCommentId` before processing.

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
  - For each `comment` event: enqueue a `process-comment` BullMQ job with payload `{ igAccountId, commentId, postId, commenterUsername, commentText, commentedAt }`
- Worker (`server/workers/process-comment.ts`):
  1. **Staleness check**: if `commentedAt` is older than 23h55m → log `status = 'dropped'`, stop (outside the 24h Instagram DM window)
  2. Check `automation_logs` for `igCommentId` — if already processed, skip
  3. Load all active automations for the IG account, ordered by `priority ASC`
  4. For each automation: check if `postId` matches AND (no keywords OR comment text contains at least one keyword, case-insensitive)
  5. First match found → **check DM daily cap** (see below):
     - If cap not reached: send DM via Graph API, insert `automation_logs` row `status = 'sent'` or `'failed'`
     - If cap reached: re-enqueue this same job delayed until **start of next UTC day**, do not insert a log row yet
  6. Stop after first match

### DM daily cap enforcement
Defined in the plan limits utility (task 008). Logic in the worker:
- Count rows in `automation_logs` where `automationId` belongs to this user AND `status = 'sent'` AND `triggeredAt >= start of current UTC day`
- Compare against the user's plan limit: **100/day (Free)**, **200/hr enforced by Instagram (Pro — no app-level daily cap)**
- If over cap: delay the BullMQ job with `{ delay: msUntilNextUTCMidnight() }` — BullMQ will re-run it tomorrow
- On re-run: staleness check runs first (step 1), so jobs that can't be delivered within 24h are automatically dropped

### `automation_logs` status values
- `sent` — DM delivered successfully
- `failed` — Graph API returned an error
- `dropped` — comment was older than 23h55m when the job ran (past the delivery window)

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
- [ ] Failed DM sends are logged with `status = 'failed'` and the error message
- [ ] Free users: DMs stop when daily cap (100) is reached; job is re-queued for next UTC day
- [ ] Jobs older than 23h55m are logged as `dropped` and not sent
- [ ] Pro users: no app-level daily cap applied
- [ ] Access tokens are encrypted at rest
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
