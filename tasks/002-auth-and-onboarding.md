# 002 — Auth and onboarding

## Goal
Implement OAuth login (Google + Instagram via Meta) using `nuxt-auth-utils`, persist users in the database, and guide first-time users through a use-case selection onboarding step before landing on the app.

## Specs

### DB schema changes
- Add `useCase` column to the `users` table: `text('use_case')` (nullable — null means onboarding not completed)
  - Accepted values: `'personal-page'` | `'instagram-automation'`
- Add `username` column to the `users` table: `text('username').unique()` (nullable until onboarding completes)
- Run `pnpm db:push` to apply (dev only)

### OAuth providers
- **Google**: `server/routes/auth/google.get.ts` using `defineOAuthGoogleEventHandler`
- **Instagram (Meta/Facebook)**: `server/routes/auth/facebook.get.ts` using `defineOAuthFacebookEventHandler`
  - Scopes needed: `email`, `public_profile`
- Both handlers must:
  1. Upsert the user in the DB (`users` table) on `provider` + `providerId`
  2. Set the session via `setUserSession(event, { user: { id, email, name, avatarUrl } })`
  3. If the user has no `useCase` (first login), redirect to `/onboarding`
  4. If the user has a `useCase` (returning), redirect to `/app`

### `/login` page (`app/pages/login.vue`)
- Clean centered card using Nuxt UI components
- "Continue with Google" button (Google colors / icon)
- "Continue with Instagram" button (Instagram gradient or brand color)
- Each button triggers its respective OAuth redirect (`/auth/google`, `/auth/facebook`)
- Redirect to `/app` if already authenticated (check `useUserSession()`)

### `/onboarding` page (`app/pages/onboarding.vue`)
- Two-step flow (single page, step state managed locally):
  - **Step 1 — Username**: text input for their public handle (`/^[a-z0-9_-]{3,32}$/`). Show live preview of their URL: `su1.ca/{username}`. Validate uniqueness via `GET /api/user/check-username?username=` before advancing.
  - **Step 2 — Use case**: two large selectable cards:
    - **Personal page** — "Create your link page at su1.ca/username" — icon: link/globe
    - **Instagram automation** — "Auto-send DMs when someone comments on your post" — icon: message/bolt
- Protected: redirect to `/login` if not authenticated; redirect to `/app` if both `username` and `useCase` are already set
- On completion: POST to `server/api/onboarding.post.ts` with `{ username, useCase }`, then redirect to `/app`
- `server/api/onboarding.post.ts`: requires auth, validates both fields, updates DB via `useDB()`
- `GET /api/user/check-username`: requires auth, returns `{ available: boolean }`

### Route middleware
- Create `app/middleware/auth.ts`: redirect to `/login` if no active session
- Apply to `/app/**` and `/onboarding` via `definePageMeta({ middleware: 'auth' })`

### Logout route
- `server/routes/auth/logout.get.ts`: clears the session via `clearUserSession(event)` and redirects to `/`

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
- [ ] `/login` renders with Google and Instagram buttons; redirects to `/app` if already logged in
- [ ] Google OAuth flow completes: user created in DB, session set, redirected correctly
- [ ] Facebook/Instagram OAuth flow completes: same as above
- [ ] First-time user lands on `/onboarding`, returning user (username + useCase set) is redirected to `/app`
- [ ] Onboarding step 1 validates username format and uniqueness before advancing
- [ ] Onboarding step 2 saves username + useCase to DB and redirects to `/app`
- [ ] Logout clears session and redirects to `/`
- [ ] `/app/**` and `/onboarding` redirect unauthenticated users to `/login`
- [ ] `.env.example` updated with Facebook vars, GitHub vars removed
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
