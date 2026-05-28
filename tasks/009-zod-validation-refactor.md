# 009 — Zod validation refactor

## Goal
Introduce Zod as the project-wide input validation library and refactor all existing API routes to use h3's validated helpers (`readValidatedBody`, `getValidatedRouterParams`, `getValidatedQuery`) instead of manual type narrowing. New routes from tasks 006–008 should already follow this pattern; this task retrofits everything that came before.

## Specs

### Install
```bash
pnpm add zod
```

### Pattern (apply everywhere)

**Before:**
```ts
const body = await readBody(event)
const { name } = body ?? {}
if (typeof name !== 'string' || name.trim().length === 0)
  throw createError({ statusCode: 400, message: 'Name is required' })
```

**After:**
```ts
import { z } from 'zod'
const { name } = await readValidatedBody(event, z.object({
  name: z.string().min(1),
}).parse)
```

h3 converts Zod `ZodError` to a 422 response automatically. Use `.parse` (not `.safeParse`) so errors propagate to h3's error handler.

For route params:
```ts
const { id } = await getValidatedRouterParams(event, z.object({
  id: z.string().uuid(),
}).parse)
```

For query strings:
```ts
const { username } = await getValidatedQuery(event, z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/),
}).parse)
```

### Routes to refactor

| File | What to validate |
|------|-----------------|
| `server/api/onboarding.post.ts` | body: `{ username: z.string().regex(...), useCase: z.enum(['personal-page', 'instagram-automation']) }` |
| `server/api/user/check-username.get.ts` | query: `{ username: z.string() }` |
| `server/api/user/settings.patch.ts` (`applySettingsUpdate`) | body: `{ name: z.string().min(1) }` — move validation into Zod, remove manual guards |
| `server/api/links.post.ts` (`applyCreateLink`) | body: `{ title: z.string().min(1), destinationUrl: z.string().url(), slug: z.string().regex(...).optional(), showOnPage: z.boolean().optional() }` |
| `server/api/links/[id].patch.ts` (`applyUpdateLink`) | body: partial of the above; params: `{ id: z.string() }` |
| `server/api/links/[id].delete.ts` | params: `{ id: z.string() }` |
| `server/api/links/[id]/stats.get.ts` | params: `{ id: z.string() }` |
| `server/routes/[username]/[slug].get.ts` | route params: `{ username: z.string(), slug: z.string() }` |

### Notes
- Where the existing pattern exports a pure `applyXxx(args)` function for testing (settings, links), move the Zod schema into the event handler; keep the pure function for logic that isn't directly validating input shape.
- Update affected tests where validation logic changes (error codes may shift from 400 to 422 for schema violations).
- The reserved-username check and DB-uniqueness check remain manual (Zod validates shape only; business rules stay in code).
- After refactor, remove any now-redundant manual `typeof` narrowing guards that Zod already covers.

## Acceptance criteria
- [ ] `zod` added to `package.json` dependencies
- [ ] All 8 routes above use `readValidatedBody` / `getValidatedRouterParams` / `getValidatedQuery` with Zod schemas
- [ ] No manual `typeof x !== 'string'` guards remain for fields already validated by Zod
- [ ] Tests updated: validation-related tests use the correct status code (422 for schema errors)
- [ ] `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
