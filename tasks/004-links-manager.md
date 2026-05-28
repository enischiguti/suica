# 004 — Links manager

## Goal
Build the links management system. Users can create short links in the format `su1.ca/username/slug`. Each link has a destination URL, an optional custom slug (auto-generated if not provided), and a flag for whether it appears on the personal page. Click analytics are recorded per link (count, referrer, device, country).

## Specs

### DB schema — new tables

**`links` table** (`server/db/schema/links.ts`):
```
id              text  PK
userId          text  FK → users.id
title           text  not null
destinationUrl  text  not null
slug            text  not null  (unique per user: UNIQUE(userId, slug))
showOnPage      bool  default false
isActive        bool  default true
createdAt       timestamp  defaultNow()
updatedAt       timestamp  defaultNow()
```

**`link_clicks` table** (`server/db/schema/link-clicks.ts`):
```
id        text  PK
linkId    text  FK → links.id (cascade delete)
clickedAt timestamp  defaultNow()
referrer  text  nullable
device    text  nullable  ('mobile' | 'tablet' | 'desktop')
country   text  nullable
```
Note: raw IPs are never stored. Dedup is handled via Redis (see analytics utility below).

Export both from `server/db/schema/index.ts`. Run `pnpm db:push`.

### Slug generation
- If user provides a custom slug: validate it matches `/^[a-z0-9-]+$/`, max 64 chars, not already taken for that user
- If no slug provided: generate from title (lowercase, spaces → `-`, strip special chars), append random 4-char suffix if collision

### API routes

**`GET /api/links`** — list all links for authenticated user, ordered by `createdAt DESC`, include click count aggregated from `link_clicks`

**`POST /api/links`** — create a link
- Body: `{ title, destinationUrl, slug?, showOnPage? }`
- Returns created link

**`PATCH /api/links/:id`** — update a link (title, destinationUrl, slug, showOnPage, isActive)
- Validates ownership (link.userId === session.user.id)

**`DELETE /api/links/:id`** — delete a link + cascade deletes clicks
- Validates ownership

### `/app/links` — Links manager page

- Top bar: "New link" button → opens a slide-over or modal
- Table/list of links with columns:
  - Title + slug (shown as `su1.ca/{username}/{slug}`, copy-to-clipboard button)
  - Destination URL (truncated)
  - Clicks count
  - "On page" toggle (checkbox/switch, calls PATCH inline)
  - Active toggle
  - Edit and Delete actions
- Empty state when no links exist
- Create/Edit form fields: Title, Destination URL, Slug (optional, shows auto-preview), "Show on personal page" toggle

### Analytics utility (`server/utils/analytics.ts`)

Shared across links (task 004/005) and personal page (task 006).

```ts
recordVisit(options: {
  key: string        // namespaced dedup key, e.g. 'link:abc123' or 'page:xyz'
  ip: string         // raw request IP — hashed internally, never stored
  insert: () => Promise<void>  // DB insert to run if not a duplicate
  ttlSeconds?: number          // dedup window, default 3600 (1 hour)
}): Promise<void>
```

Implementation:
1. Compute `hash = SHA-256(ip + ":" + dailySalt)` where `dailySalt = SHA-256(ANALYTICS_SALT + currentUTCDate)` — rotates daily so hashes can't be correlated across days
2. Build Redis key: `dedup:{key}:{hash}`
3. `SET dedup:{key}:{hash} 1 EX {ttlSeconds} NX` — atomic: returns `null` if key already existed
4. If result is `null` (duplicate within window) → return early, skip insert
5. Otherwise → call `insert()` to write the DB row

`ANALYTICS_SALT` is a secret env var (any random string). Add to `.env.example`.

### Click analytics per link
- Clicking the click count opens a simple stats drawer/modal showing:
  - Total clicks (unique per IP per hour)
  - Top referrers (top 5)
  - Device breakdown (mobile / tablet / desktop %)
  - Top countries (top 5)
- Query aggregated from `link_clicks` grouped by the relevant field

## Acceptance criteria
- [ ] User can create a link with auto-generated or custom slug
- [ ] Duplicate slug for same user is rejected with a clear error
- [ ] Link list shows title, short URL, destination, click count, toggles
- [ ] "Show on page" toggle updates instantly (optimistic UI)
- [ ] Editing a link updates destination URL and other fields
- [ ] Deleting a link removes it and its click records
- [ ] Click stats modal shows referrers, devices, and countries
- [ ] A second redirect from the same IP within 1 hour is not recorded as a new click
- [ ] Raw IPs are never written to the database
- [ ] All API routes validate auth and ownership
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
