# 002 — Auth and onboarding

## Goal
Implement OAuth login (Google + Instagram via Meta) using `nuxt-auth-utils`, persist users in the database, and guide first-time users through a use-case selection onboarding step before landing on their dashboard.

## Specs

### DB schema changes
- Add `useCase` column to the `users` table: `text('use_case')` (nullable — null means onboarding not completed)
  - Accepted values: `'personal-page'` | `'instagram-automation'`
- Run `pnpm db:push` to apply (dev only)

### OAuth providers
- **Google**: `server/routes/auth/google.get.ts` using `defineOAuthGoogleEventHandler`
- **Instagram (Meta/Facebook)**: `server/routes/auth/facebook.get.ts` using `defineOAuthFacebookEventHandler`
  - Scopes needed: `email`, `public_profile`
- Both handlers must:
  1. Upsert the user in the DB (`users` table) on `provider` + `providerId`
  2. Set the session via `setUserSession(event, { user: { id, email, name, avatarUrl } })`
  3. If the user has no `useCase` (first login), redirect to `/onboarding`
  4. If the user has a `useCase` (returning), redirect to `/dashboard`

### `/login` page (`app/pages/login.vue`)
- Clean centered card using Nuxt UI components
- "Continue with Google" button (Google colors / icon)
- "Continue with Instagram" button (Instagram gradient or brand color)
- Each button triggers its respective OAuth redirect (`/auth/google`, `/auth/facebook`)
- Redirect to `/dashboard` if already authenticated (check `useUserSession()`)

### `/onboarding` page (`app/pages/onboarding.vue`)
- Protected: redirect to `/login` if not authenticated
- Redirect to `/dashboard` if `useCase` is already set
- Two large selectable cards side by side:
  - **Personal page** — "Create your link page at su1.ca/username" — icon: link/globe
  - **Instagram automation** — "Auto-send DMs when someone comments on your post" — icon: message/bolt
- On selection: POST to `server/api/onboarding.post.ts` which saves `useCase` to the user's DB row, then redirect to `/dashboard`
- `server/api/onboarding.post.ts`: requires auth session, validates `useCase` value, updates DB via `useDB()`

### `/dashboard` page (`app/pages/dashboard.vue`)
- Protected: redirect to `/login` if not authenticated
- Shows user profile card:
  - Avatar (from OAuth, use `<UAvatar>`)
  - Display name and email
  - Badge showing selected use case
- "Log out" button: calls `$fetch('/auth/logout')` then redirects to `/`
- `server/routes/auth/logout.get.ts`: clears the session and redirects to `/`

### Route middleware
- Create `app/middleware/auth.ts`: redirect to `/login` if no active session
- Apply to `/dashboard` and `/onboarding` via `definePageMeta({ middleware: 'auth' })`

### Environment variables needed (`.env`)
```
NUXT_OAUTH_GOOGLE_CLIENT_ID=
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=
NUXT_OAUTH_FACEBOOK_CLIENT_ID=
NUXT_OAUTH_FACEBOOK_CLIENT_SECRET=
```
Update `.env.example` accordingly (replace the GitHub vars).

### nuxt.config.ts
- Update `runtimeConfig.oauth` to replace `github` block with `facebook`

## Acceptance criteria
- [ ] `/login` renders with Google and Instagram buttons; redirects to `/dashboard` if already logged in
- [ ] Google OAuth flow completes: user created in DB, session set, redirected correctly
- [ ] Facebook/Instagram OAuth flow completes: same as above
- [ ] First-time user lands on `/onboarding`, returning user skips it
- [ ] Use case selection saves to DB and redirects to `/dashboard`
- [ ] `/dashboard` shows avatar, name, email, use case badge, and logout button
- [ ] Logout clears session and redirects to `/`
- [ ] `/dashboard` and `/onboarding` redirect unauthenticated users to `/login`
- [ ] `.env.example` updated with Facebook vars, GitHub vars removed
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
