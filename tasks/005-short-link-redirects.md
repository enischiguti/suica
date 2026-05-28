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
- `username` column is added to the `users` table in task 002 (onboarding step 1)
- This task depends on task 002 being completed first

### `su1.ca/username` (no slug)
- Handled natively by Nuxt's `app/pages/[username].vue` (implemented in task 006) — no server route needed here

### Click recording
- Insert into `link_clicks` via `useDB()` — fire-and-forget: do not await, use `.catch(console.error)` to swallow errors without blocking the redirect

## Acceptance criteria
- [ ] `su1.ca/existing-user/valid-slug` redirects to the destination URL with a 302
- [ ] Click is recorded with referrer, device, country
- [ ] `su1.ca/existing-user/invalid-slug` returns 404
- [ ] `su1.ca/nonexistent-user/anything` returns 404
- [ ] Inactive links (isActive = false) return 404, not redirect
- [ ] `username` column (from task 002) is used to look up the user correctly
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
