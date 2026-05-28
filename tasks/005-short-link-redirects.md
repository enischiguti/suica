# 005 — Short link redirects and click recording

## Goal
Handle incoming requests to `su1.ca/username/slug`: look up the link, record the click with referrer, device, and country, then immediately 302-redirect the visitor to the destination URL. Also handle `su1.ca/username` to serve the personal page (implemented in task 006).

## Specs

### Catch-all server route
- `server/routes/[username]/[slug].get.ts`
- Logic:
  1. Query `links` joined with `users` where `users.username = params.username` AND `links.slug = params.slug` AND `links.isActive = true`
  2. If not found → 404
  3. Record click asynchronously (do not await — redirect first, record after):
     - `referrer`: from `Referer` request header, nullable
     - `device`: derived from `User-Agent` header (`mobile` if `/mobile|android/i`, `tablet` if `/tablet|ipad/i`, else `desktop`)
     - `country`: from `CF-IPCountry` header (Cloudflare) or `X-Vercel-IP-Country`, nullable — store raw 2-letter code
  4. Return `sendRedirect(event, link.destinationUrl, 302)`

### Username field on users
- Add `username` column to the `users` table: `text('username').unique()` (nullable initially)
- During onboarding (task 002): after use-case selection, ask the user to pick their username
  - Validate: `/^[a-z0-9_-]{3,32}$/`, unique across all users
  - Save to DB before redirecting to `/app`
- Update task 002's onboarding spec: add username selection as step before or after use-case selection

### `server/routes/[username].get.ts`
- Handles `su1.ca/username` (no slug)
- Returns 404 for now with a note — the personal page is implemented in task 006

### Click recording
- Insert into `link_clicks` via `useDB()` — fire-and-forget using `event.waitUntil()` or plain async insert after redirect

## Acceptance criteria
- [ ] `su1.ca/existing-user/valid-slug` redirects to the destination URL with a 302
- [ ] Click is recorded with referrer, device, country
- [ ] `su1.ca/existing-user/invalid-slug` returns 404
- [ ] `su1.ca/nonexistent-user/anything` returns 404
- [ ] Inactive links (isActive = false) return 404, not redirect
- [ ] `username` column exists on users, unique constraint enforced
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
