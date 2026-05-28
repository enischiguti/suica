# Suica — Project Guide

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt 4 (app/ directory) |
| UI | Nuxt UI v3 (Tailwind v4) |
| Auth | nuxt-auth-utils — OAuth via Google + GitHub |
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
3. Read the full spec from the linked file (e.g. `tasks/001-auth-flow.md`)
4. Spawn a sub-agent (Agent tool) with the spec + the conventions from this file
5. After the agent completes, verify acceptance criteria
6. Update status to `✅ done` — or `🚫 blocked` with a note in the spec's Notes section if it failed
7. Continue to the next `⬜ todo` task, or stop if the user said "work on task NNN" (single task)

When asked to **"work on task NNN"**: run only that task (steps 2–6 above).

### Task file format

See `tasks/000-template.md` for the canonical spec structure.

### Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | todo — not started |
| 🔄 | progress — agent is working on it |
| ✅ | done — accepted |
| 🚫 | blocked — needs human input, see Notes |
