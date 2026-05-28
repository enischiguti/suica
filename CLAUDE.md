# Suica — Project Guide

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt 4 (app/ directory) |
| UI | Nuxt UI v3 (Tailwind v4) |
| Auth | better-auth — OAuth (Google, Facebook) + Email OTP |
| Database | PostgreSQL + Drizzle ORM |
| Payments | Stripe subscriptions |
| Email | Mailgun (`mailgun.js`) |
| Jobs | BullMQ + Redis |
| Deploy | Node server (self-hosted) |

## Conventions

- **Path aliases**: use `~~` (project root) or `~` (app/) — relative imports (`./ ../`) are forbidden by ESLint
- **No `!` assertions**: `ts/no-non-null-assertion` is an error — use `useRuntimeConfig()` for env vars in server files
- **No type assertions**: `ts/consistent-type-assertions` with `assertionStyle: never` — narrow types with guards
- **Linting**: `@antfu/eslint-config` — run `pnpm lint:fix` to auto-fix style issues
- **Server singletons**: DB, Redis, Stripe, and Mailgun clients are lazy singletons (`useDB()`, `useRedis()`, `useStripe()`) initialized inside functions so `useRuntimeConfig()` has context
- **Pre-commit hook**: `pnpm lint && pnpm typecheck` runs automatically via `simple-git-hooks`

## Frontend guidelines

- **Responsive**: every page and component must work on mobile, tablet, and desktop
- **Nuxt UI first**: use Nuxt UI v3 components (`UButton`, `UCard`, `UInput`, `UModal`, `UTable`, etc.) for all UI — do not reach for raw HTML elements or third-party component libraries when a Nuxt UI equivalent exists
- **App-level customization**: theme tokens, default props, and component variants go in `app/app.config.ts` (`ui` key) — override at the component level only when a one-off is truly needed

## Testing

- **Framework**: Vitest + `@nuxt/test-utils` for unit and integration tests; test files live alongside source in `*.test.ts` files
- **Tests are required**: writing tests is an acceptance criterion for every task — a task is not done until `pnpm test` passes
- **What to test**:
  - *Server*: every API route (happy path + key error cases), utility functions with non-trivial logic (slug generation, analytics dedup, plan enforcement, webhook signature verification)
  - *Client*: composables and utilities with logic; page-level tests for critical flows (form validation, auth redirects) using `@nuxt/test-utils` mount helpers
  - *Workers*: BullMQ job handlers tested in isolation with mocked DB and external API calls

## Key files

```
server/db/index.ts          — useDB() Drizzle client
server/db/schema/users.ts   — users table
server/utils/stripe.ts      — useStripe() singleton
server/utils/queue.ts       — useRedis(), createQueue(), createWorker()
server/utils/mail.ts        — sendMail()
nuxt.config.ts              — runtimeConfig (reads DATABASE_URL, REDIS_URL, etc.)
drizzle.config.ts           — Drizzle Kit config (reads DATABASE_URL directly)
docker-compose.yml          — postgres:17 + redis:7 for local dev
.env.example                — all required env vars
```

## Local dev

```bash
cp .env.example .env        # fill in secrets
docker compose up -d        # start postgres + redis
pnpm install
pnpm db:push                # push schema to DB (dev only)
pnpm dev                    # start on localhost:3000
```

---

## Task orchestration

Tasks live in `tasks/`. The index at `tasks/index.md` is the source of truth for what's done, in-progress, or pending.

### Running tasks

When asked to **"run tasks"**:
1. Read `tasks/index.md` — find the first `⬜ todo` row
2. Update its status to `🔄 progress`
3. Read the full spec from the linked file (e.g. `tasks/001-landing-page.md`)
4. Spawn an **implementation agent** (Agent tool) with the spec + the conventions from this file; instruct it to:
   - Create and check out branch `task/NNN-short-title` (e.g. `task/001-landing-page`)
   - Implement the spec, run `pnpm test && pnpm lint && pnpm typecheck`
   - Push the branch and open a PR titled `[Task NNN] Title` targeting `main`
5. Once the implementation agent completes, spawn a **review agent** (Agent tool, `subagent_type: code-review`) pointing it at the PR number
6. If the review passes: merge the PR, update task status to `✅ done`
7. If the review surfaces blocking issues: leave the task as `🔄 progress`, add a note in the spec's Notes section, and fix before re-requesting review
8. If the task cannot proceed: set status to `🚫 blocked` with a note in the spec's Notes section
9. Continue to the next `⬜ todo` task, or stop if the user said "work on task NNN" (single task)

When asked to **"work on task NNN"**: run only that task (steps 2–8 above).

### Editing vs. creating tasks

- **⬜ todo** — spec can be edited freely in place.
- **🔄 progress / ✅ done / 🚫 blocked** — the spec is frozen. Any improvement or follow-up must become a **new task** appended to `tasks/index.md`.

### Task file format

See `tasks/000-template.md` for the canonical spec structure.

### Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | todo — not started |
| 🔄 | progress — agent is working on it |
| ✅ | done — accepted |
| 🚫 | blocked — needs human input, see Notes |
