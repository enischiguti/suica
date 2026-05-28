# 003 — App shell

## Goal
Build the authenticated app shell: the `/app` home screen with feature entry cards, a shared layout with top navigation, and a basic account/settings page. This task creates the skeleton that later tasks fill with real features.

## Specs

### Shared app layout (`app/layouts/app.vue`)
- Top navigation bar (sticky):
  - Left: Suica logo/wordmark linking to `/app`
  - Right: user avatar (`<UAvatar>`) + dropdown menu with "Account" (`/app/settings`) and "Log out"
- Logout action: POST/GET to `/auth/logout` then redirect to `/`
- Apply this layout to all `/app/**` pages via `definePageMeta({ layout: 'app' })`
- All `/app/**` pages live under `app/pages/app/` (e.g. `app/pages/app/index.vue`, `app/pages/app/settings.vue`)

### `/app` — Home screen (`app/pages/app/index.vue`)
- Three feature cards side by side (stack on mobile):
  - **My Page** — "Your personal link page at su1.ca/username" — icon: globe or link — links to `/app/page`
  - **My Links** — "Short links and analytics" — icon: chart-bar or arrow-up-right — links to `/app/links`
  - **Automations** — "Instagram DM automations" — icon: bolt or message — links to `/app/automations`
- Below the cards: a small welcome message using the user's name from session

### `/app/settings` — Account page
- Profile section: avatar, display name (editable), email (read-only)
- Danger zone: "Delete account" button (confirmation modal, no backend action yet — just UI)
- Save button POSTs to `server/api/user/settings.patch.ts` which updates `name` in the users table

### `server/api/user/settings.patch.ts`
- Requires auth session
- Accepts `{ name: string }`, validates non-empty
- Updates user row via `useDB()`
- Returns updated user

### Route protection
- All `/app/**` pages must use the `auth` middleware created in task 002

## Acceptance criteria
- [ ] `/app` shows three feature cards linking to the correct sub-routes
- [ ] Top nav shows the logged-in user's avatar and name
- [ ] Logout from the nav dropdown clears the session and redirects to `/`
- [ ] `/app/settings` lets users update their display name (persists to DB)
- [ ] Navigating to any `/app/**` route while logged out redirects to `/login`
- [ ] Layout is responsive (nav and cards stack correctly on mobile)
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
