# 006 — Personal page (public profile)

## Goal
Build the public-facing personal page at `su1.ca/username` and the in-app editor at `/app/page`. Users can display their profile photo, bio, social icon links, and a curated selection of their short links. They can pick a preset theme and choose between their OAuth avatar or a custom uploaded image (via Cloudflare Images).

## Specs

### DB schema additions

**`page_profiles` table** (`server/db/schema/page-profiles.ts`):
```
id          text  PK
userId      text  FK → users.id  UNIQUE (one profile per user)
bio         text  nullable  (max 160 chars)
theme       text  default 'default'
socials     jsonb nullable  (array of { platform, url })
createdAt   timestamp  defaultNow()
updatedAt   timestamp  defaultNow()
```

Platforms for socials: `instagram | x | tiktok | youtube | linkedin | github | website`

Add `customAvatarUrl` column to `page_profiles`: `text('custom_avatar_url')` nullable. When set, it takes precedence over `users.avatarUrl` on the public page and in the editor preview.

**`page_visits` table** (`server/db/schema/page-visits.ts`):
```
id        text  PK
userId    text  FK → users.id (cascade delete)
visitedAt timestamp  defaultNow()
referrer  text  nullable
device    text  nullable  ('mobile' | 'tablet' | 'desktop')
country   text  nullable
```
Raw IPs are never stored. Dedup uses the `recordVisit` utility from task 004.

### Preset themes (stored as `theme` string)
Define in `app/utils/themes.ts` (or similar) — each theme has a `bg`, `cardBg`, `text`, `button` color set:
- `default` — white background, dark text, green buttons
- `midnight` — near-black bg, white text, rose accent buttons
- `rose` — soft rose bg, dark text, green buttons
- `forest` — deep green bg, white text, rose buttons

### Public page `su1.ca/username` (`server/routes/[username].get.ts` → `app/pages/[username].vue`)

Actually implement this as a Nuxt page:
- `app/pages/[username].vue` — no auth required, SSR rendered
- Fetch profile + links from `GET /api/public/[username]` server route
- Layout: no top nav (standalone page, different layout or `layout: false`)
- Display:
  - Avatar (circular, from `page_profiles.customAvatarUrl` if set, else `users.avatarUrl`)
  - Display name
  - Bio (if set)
  - Social icons row (icon buttons linking to each platform URL)
  - Ordered list of link buttons (links where `showOnPage = true AND isActive = true`), ordered by `createdAt ASC` for now
  - Each link button: full-width, title, styled per theme
- Apply theme colors based on `page_profiles.theme`
- `<title>` and `<meta description>` set via `useSeoMeta` (name + bio)

**`GET /api/public/[username]`** (`server/api/public/[username].get.ts`):
- No auth required
- Returns: `{ user: { name, avatarUrl, username }, profile: { bio, theme, socials, customAvatarUrl }, links: Link[] }`
- Avatar resolution logic lives in the API: return `customAvatarUrl ?? avatarUrl` as the effective avatar

**`POST /api/public/[username]/visit`** (`server/api/public/[username]/visit.post.ts`):
- No auth required
- Called client-side from `onMounted` in `app/pages/[username].vue` (fire-and-forget fetch, no await)
- Derives referrer, device, country from request headers (same logic as link clicks in task 005)
- Calls `recordVisit` from `server/utils/analytics.ts`:
  ```ts
  recordVisit({
    key: `page:${user.id}`,
    ip: getRequestIP(event, { xForwardedFor: true }) ?? '',
    insert: () => useDB().insert(pageVisits).values({ ... }),
  })
  ```
- Returns `{ ok: true }` — client ignores the response
- 404 if user not found

### Page editor `/app/page`

- Live preview panel on the right (desktop) showing how the page looks, updates as user edits
- Left panel — edit sections:
  - **Avatar**: circular preview showing the current effective avatar; two options below it:
    - "Use account avatar" — resets `customAvatarUrl` to null (uses OAuth avatar)
    - "Upload image" — file picker (JPG/PNG/WebP, max 5 MB); triggers the Cloudflare Images upload flow
  - **Profile**: name (editable, syncs to `users.name`), bio (textarea, 160 char limit with counter)
  - **Socials**: add/remove social platform + URL pairs (up to 7 platforms)
  - **Theme picker**: 4 preset cards showing a color swatch, clicking selects it
  - **Links on page**: list of the user's links with a toggle for `showOnPage` (links to `/app/links` to create new ones)
- **Stats** (read-only section at the bottom of the editor): total page visits, top referrers (top 5), device breakdown, top countries — fetched from `GET /api/user/page/stats`
- Save button: `PATCH /api/user/page` — saves bio, socials, theme, customAvatarUrl; returns updated profile

**`GET /api/user/page/stats`** (`server/api/user/page/stats.get.ts`):
- Requires auth
- Returns aggregated counts from `page_visits` for the authenticated user:
  `{ total, referrers: [{ value, count }], devices: [{ value, count }], countries: [{ value, count }] }`

### Avatar upload — Cloudflare Images flow

1. Client picks a file → calls `POST /api/user/avatar-upload-url` (auth required)
2. Server requests a one-time direct upload URL from Cloudflare Images API:
   ```
   POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/images/v2/direct_upload
   Authorization: Bearer {CLOUDFLARE_IMAGES_TOKEN}
   ```
   Returns `{ uploadURL, id }`.
3. Server returns `{ uploadURL, imageId }` to the client (never expose the token to the client)
4. Client POSTs the file directly to `uploadURL` (multipart/form-data) — upload goes straight to Cloudflare, not through the app server
5. On success, client calls `PATCH /api/user/page` with `{ customAvatarUrl: \`https://imagedelivery.net/{CLOUDFLARE_IMAGES_HASH}/{imageId}/public\` }`
6. Editor preview updates immediately via the live preview panel

**`POST /api/user/avatar-upload-url`** (`server/api/user/avatar-upload-url.post.ts`):
- Requires auth
- Calls Cloudflare Images direct upload endpoint
- Returns `{ uploadURL: string, imageId: string }`
- Never forwards the Cloudflare token to the client

**`PATCH /api/user/page`** (`server/api/user/page.patch.ts`):
- Requires auth
- Accepts `{ bio?, socials?, theme?, customAvatarUrl? }` — `null` clears the custom avatar
- Upserts `page_profiles` row for the user

### New environment variables
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_IMAGES_TOKEN=
CLOUDFLARE_IMAGES_HASH=   # the hash in imagedelivery.net URLs, found in CF dashboard
```

### Route for the public page
- No server route needed. Nuxt handles `su1.ca/username` natively via `app/pages/[username].vue`. The only server route touching the `[username]` namespace is `server/routes/[username]/[slug].get.ts` (task 005), which sits one level deeper and does not conflict.

## Acceptance criteria
- [ ] `su1.ca/username` renders the public page with avatar, bio, socials, and active links
- [ ] Custom avatar takes precedence over OAuth avatar when set; OAuth avatar shown as fallback
- [ ] Theme is applied correctly — at least default and one other theme visually distinct
- [ ] `useSeoMeta` sets correct title and description
- [ ] `/app/page` editor saves bio, socials, and theme to DB
- [ ] Uploading an image completes the full Cloudflare Images flow; avatar updates in the preview
- [ ] "Use account avatar" resets the custom avatar and shows the OAuth avatar in the preview
- [ ] Cloudflare token is never sent to the client
- [ ] Link `showOnPage` toggles in the editor update immediately
- [ ] Live preview in the editor reflects current settings without a page reload
- [ ] Visiting `su1.ca/username` records a page visit (referrer, device, country)
- [ ] A second visit from the same IP within 1 hour is not counted
- [ ] Raw IPs are never written to the database
- [ ] Page stats section in the editor shows total visits, referrers, devices, countries
- [ ] Public page is accessible without auth
- [ ] Tests written: `GET /api/public/[username]` (found, not found, avatar resolution logic), `POST /api/public/[username]/visit` (dedup, unknown user → 404), `PATCH /api/user/page` (auth required, upsert), `GET /api/user/page/stats` (auth required, free vs pro breakdown), `POST /api/user/avatar-upload-url` (auth required, token never in response)
- [ ] `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
