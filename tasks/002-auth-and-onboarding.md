# 002 — Auth and onboarding

## Goal
Implement authentication using `better-auth` with Google OAuth, Facebook OAuth, and Email OTP. Persist users in the database with multi-provider account linking (same email across providers → same user). Guide first-time users through a use-case selection onboarding step before landing on the app.

## Specs

### Packages
```bash
pnpm add better-auth @better-auth/drizzle
```
No separate Nuxt module needed — better-auth exposes a catch-all API handler and a client composable.

### Auth server config (`server/utils/auth.ts`)
Export a `useAuth()` singleton (lazy, initialized inside a function per CLAUDE.md convention):

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle'
import { emailOTP } from 'better-auth/plugins'

export const useAuth = () => betterAuth({
  database: drizzleAdapter(useDB(), { provider: 'pg' }),
  emailAndPassword: { enabled: false },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp }) => {
        await sendMail({ to: email, subject: 'Your Suica login code', text: `Your code: ${otp}` })
      },
      otpLength: 6,
      expiresIn: 600, // 10 min
    }),
  ],
  socialProviders: {
    google: {
      clientId: useRuntimeConfig().oauth.google.clientId,
      clientSecret: useRuntimeConfig().oauth.google.clientSecret,
    },
    facebook: {
      clientId: useRuntimeConfig().oauth.facebook.clientId,
      clientSecret: useRuntimeConfig().oauth.facebook.clientSecret,
      scopes: ['email', 'public_profile'],
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'facebook'], // auto-link on matching verified email
    },
  },
  user: {
    additionalFields: {
      username: { type: 'string', required: false, defaultValue: null },
      useCase: { type: 'string', required: false, defaultValue: null },
      avatarUrl: { type: 'string', required: false, defaultValue: null },
    },
  },
})
```

### Catch-all API handler (`server/routes/auth/[...all].ts`)
```ts
export default defineEventHandler(event => toWebHandler(useAuth().handler)(event))
```
This mounts all better-auth endpoints under `/auth/**` (sign-in, sign-out, session, OTP, callbacks, etc.).

### Client composable (`app/utils/auth.ts`)
```ts
import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: '/',
  plugins: [emailOTPClient()],
})
```
Use `authClient.useSession()` in components for reactive session state.

### DB schema changes

**Modify `users` table** (`server/db/schema/users.ts`):
- Add `emailVerified: boolean('email_verified').default(false).notNull()`
- Add `username: text('username').unique()` (nullable)
- Add `useCase: text('use_case')` (nullable — null means onboarding not completed; values: `'personal-page'` | `'instagram-automation'`)
- Add `avatarUrl: text('avatar_url')` (nullable — populated from OAuth profile image on first sign-in)
- Remove `provider` and `providerId` columns (replaced by the `accounts` table below)

**New `accounts` table** (`server/db/schema/accounts.ts`) — managed by better-auth, one row per OAuth connection per user:
```
id                text  PK
userId            text  FK → users.id (cascade delete)
accountId         text  not null  (provider's user ID)
providerId        text  not null  (e.g. 'google', 'facebook', 'email-otp')
accessToken       text  nullable
refreshToken      text  nullable
accessTokenExpiresAt  timestamp  nullable
createdAt         timestamp  defaultNow()
updatedAt         timestamp  defaultNow()
```

**New `sessions` table** (`server/db/schema/sessions.ts`) — managed by better-auth:
```
id        text  PK
userId    text  FK → users.id (cascade delete)
token     text  not null  unique
expiresAt timestamp  not null
createdAt timestamp  defaultNow()
updatedAt timestamp  defaultNow()
ipAddress text  nullable
userAgent text  nullable
```

**New `verifications` table** (`server/db/schema/verifications.ts`) — managed by better-auth (stores OTP tokens):
```
id         text  PK
identifier text  not null  (email address)
value      text  not null  (hashed OTP)
expiresAt  timestamp  not null
createdAt  timestamp  defaultNow()
updatedAt  timestamp  defaultNow()
```

Export all new tables from `server/db/schema/index.ts`. Run `pnpm db:push`.

### Account linking behaviour
When a user signs in with a provider whose email matches an existing account:
- better-auth auto-links the new provider to the existing user (no duplicate user created)
- This covers: Google + Facebook with same email, and OTP with an email that already has an OAuth account
- `avatarUrl` on the users table: populate from the OAuth profile on first sign-in; do not overwrite on subsequent sign-ins (user may have customised it)

### `/login` page (`app/pages/login.vue`)
- Clean centered card using Nuxt UI components
- **"Continue with Google"** button → `authClient.signIn.social({ provider: 'google', callbackURL: '/auth/callback' })`
- **"Continue with Facebook"** button → `authClient.signIn.social({ provider: 'facebook', callbackURL: '/auth/callback' })`
- **Email OTP section**: email input + "Send code" button → `authClient.emailOtp.sendVerificationCode({ email })`, then show 6-digit code input + "Verify" button → `authClient.emailOtp.signIn({ email, otp, callbackURL: '/auth/callback' })`
- Redirect to `/app` if already authenticated (check `authClient.useSession()`)

### Post-auth redirect (`server/routes/auth/callback.get.ts`)
After better-auth completes sign-in it redirects to `callbackURL`. Intercept here to decide where to send the user:
- Query the user from DB using the session
- If `username` and `useCase` are both set → redirect to `/app`
- Otherwise → redirect to `/onboarding`

### `/onboarding` page (`app/pages/onboarding.vue`)
- Two-step flow (single page, step state managed locally):
  - **Step 1 — Username**: text input for their public handle (`/^[a-z0-9_-]{3,32}$/`). Show live preview of their URL: `su1.ca/{username}`. Validate uniqueness via `GET /api/user/check-username?username=` before advancing.
  - Reserved usernames are blocked at the application layer (both client-side and in `check-username`). Blocked list: `app`, `api`, `auth`, `login`, `logout`, `onboarding`, `webhooks`, `privacy`, `terms`, `instagram`, `static`, `cdn`, `admin`, `support`, `help`, `billing`.
  - **Step 2 — Use case**: two large selectable cards:
    - **Personal page** — "Create your link page at su1.ca/username" — icon: link/globe
    - **Instagram automation** — "Auto-send DMs when someone comments on your post" — icon: message/bolt
- Protected: redirect to `/login` if not authenticated; redirect to `/app` if both `username` and `useCase` are already set
- On completion: POST to `server/api/onboarding.post.ts` with `{ username, useCase }`, then redirect to `/app`
- `server/api/onboarding.post.ts`: requires auth session, validates both fields, updates DB via `useDB()`
- `GET /api/user/check-username`: requires auth session, returns `{ available: boolean }`

### Session access in server routes
Use better-auth's session helper instead of nuxt-auth-utils:
```ts
const session = await useAuth().api.getSession({ headers: event.headers })
if (!session) throw createError({ statusCode: 401 })
const userId = session.user.id
```
Create a shared `server/utils/session.ts` helper `requireSession(event)` that wraps this and throws 401 if unauthenticated.

### Route middleware (`app/middleware/auth.ts`)
```ts
const { data: session } = await authClient.useSession()
if (!session.value) return navigateTo('/login')
```
Apply to `/app/**` and `/onboarding` via `definePageMeta({ middleware: 'auth' })`.

### Logout
Call `authClient.signOut()` from the client (better-auth handles session invalidation). After sign-out, redirect to `/`.

### nuxt.config.ts
- Remove nuxt-auth-utils config
- Add to `runtimeConfig`:
  ```ts
  oauth: {
    google: { clientId: '', clientSecret: '' },
    facebook: { clientId: '', clientSecret: '' },
  }
  ```

### Environment variables
```
NUXT_OAUTH_GOOGLE_CLIENT_ID=
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=
NUXT_OAUTH_FACEBOOK_CLIENT_ID=
NUXT_OAUTH_FACEBOOK_CLIENT_SECRET=
BETTER_AUTH_SECRET=        # random 32+ char string for signing sessions
BETTER_AUTH_URL=           # e.g. https://su1.ca (or http://localhost:3000 locally)
```
Update `.env.example` accordingly (replace GitHub and nuxt-auth-utils vars).

## Acceptance criteria
- [ ] `/login` renders Google, Facebook, and Email OTP sign-in options; redirects to `/app` if already logged in
- [ ] Google OAuth flow completes: user upserted in DB, session set, redirected correctly
- [ ] Facebook OAuth flow completes: same as above
- [ ] Email OTP flow: code sent via Mailgun, correct code signs the user in, wrong code is rejected
- [ ] Signing in with a second provider that shares an email links to the existing user (no duplicate `users` row)
- [ ] `avatarUrl` is set from OAuth profile on first sign-in and not overwritten on subsequent sign-ins
- [ ] First-time user (no username or useCase) lands on `/onboarding`
- [ ] Returning user (username + useCase set) is redirected to `/app`
- [ ] Onboarding step 1 validates username format, reserved list, and uniqueness before advancing
- [ ] Onboarding step 2 saves username + useCase to DB and redirects to `/app`
- [ ] Logout clears session and redirects to `/`
- [ ] `/app/**` and `/onboarding` redirect unauthenticated users to `/login`
- [ ] `.env.example` updated; nuxt-auth-utils vars removed
- [ ] Tests written: `requireSession` helper, `check-username` API (format, reserved list, uniqueness), `onboarding.post` API (validation, DB update), username regex utility
- [ ] `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
