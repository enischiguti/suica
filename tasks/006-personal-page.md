# 006 — Personal page (public profile)

## Goal
Build the public-facing personal page at `su1.ca/username` and the in-app editor at `/app/page`. Users can display their profile photo, bio, social icon links, and a curated selection of their short links. They can pick a preset theme for the page's appearance.

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

Profile photo comes from `users.avatarUrl` (OAuth-provided) — no upload in this task.

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
  - Avatar (circular, from `users.avatarUrl`)
  - Display name
  - Bio (if set)
  - Social icons row (icon buttons linking to each platform URL)
  - Ordered list of link buttons (links where `showOnPage = true AND isActive = true`), ordered by `createdAt ASC` for now
  - Each link button: full-width, title, styled per theme
- Apply theme colors based on `page_profiles.theme`
- `<title>` and `<meta description>` set via `useSeoMeta` (name + bio)

**`GET /api/public/[username]`** (`server/api/public/[username].get.ts`):
- No auth required
- Returns: `{ user: { name, avatarUrl, username }, profile: { bio, theme, socials }, links: Link[] }`
- 404 if user not found

### Page editor `/app/page`

- Live preview panel on the right (desktop) showing how the page looks, updates as user edits
- Left panel — edit sections:
  - **Profile**: name (editable, syncs to `users.name`), bio (textarea, 160 char limit with counter)
  - **Socials**: add/remove social platform + URL pairs (up to 7 platforms)
  - **Theme picker**: 4 preset cards showing a color swatch, clicking selects it
  - **Links on page**: list of the user's links with a toggle for `showOnPage` (links to `/app/links` to create new ones)
- Save button: `PATCH /api/user/page` — saves bio, socials, theme; returns updated profile

**`PATCH /api/user/page`** (`server/api/user/page.patch.ts`):
- Requires auth
- Accepts `{ bio?, socials?, theme? }`
- Upserts `page_profiles` row for the user

### Route for the public page
- Update `server/routes/[username].get.ts` (from task 005) to no longer return 404 — instead, let Nuxt's `app/pages/[username].vue` handle it (Nuxt routing takes over for non-`/api` and non-`/auth` paths)

## Acceptance criteria
- [ ] `su1.ca/username` renders the public page with avatar, bio, socials, and active links
- [ ] Theme is applied correctly — at least default and one other theme visually distinct
- [ ] `useSeoMeta` sets correct title and description
- [ ] `/app/page` editor saves bio, socials, and theme to DB
- [ ] Link `showOnPage` toggles in the editor update immediately
- [ ] Live preview in the editor reflects current settings without a page reload
- [ ] Public page is accessible without auth
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
