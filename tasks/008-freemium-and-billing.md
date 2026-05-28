# 008 — Freemium and billing

## Goal
Implement the Free/Pro subscription model: plan limits definition, Stripe Checkout for upgrades, webhook-driven subscription state, billing management UI, and upgrade nudges throughout the app.

## Specs

### Plan definitions (`shared/plans.ts`)
Single source of truth, auto-imported on both client and server (Nuxt 4 `shared/` directory):

```ts
export const PLANS = {
  free: {
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    limits: {
      links: 10,
      automations: 1,
      dmsPerDay: 100,
      analyticsBreakdown: false,  // referrer/device/country hidden
    },
  },
  pro: {
    name: 'Pro',
    price: { monthly: 9, annual: 7 },
    limits: {
      links: 1000,
      automations: 20,
      dmsPerDay: null,            // no app-level cap; Instagram enforces 200/hr
      analyticsBreakdown: true,
    },
  },
} as const
```

### Plan enforcement utility (`server/utils/plan.ts`)
Helper functions used across API routes and the BullMQ worker:

- `getUserPlan(userId)` → `'free' | 'pro'` — reads `users.subscriptionStatus`; returns `'pro'` if status is `active` or `trialing`, else `'free'`
- `canAddLink(userId)` → `boolean`
- `canAddAutomation(userId)` → `boolean`
- `getDailyDmsCount(userId)` → `number` — queries `automation_logs` for today's sent count
- `isAnalyticsBreakdownAllowed(userId)` → `boolean`

Warning threshold: 80% of a limit triggers a soft warning; 100% blocks the action.

### DB changes
`users` table already has `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `subscriptionStatus` from the initial schema. No new columns needed.

Add a `billingInterval` column: `text('billing_interval').default('monthly')` (`'monthly' | 'annual'`) — set by the Stripe Checkout session and updated via webhook.

### Stripe Checkout flow

**`POST /api/billing/checkout`** (`server/api/billing/checkout.post.ts`):
- Requires auth
- Body: `{ interval: 'monthly' | 'annual' }`
- Creates or retrieves a Stripe Customer for the user (`stripeCustomerId`)
- Creates a Checkout Session:
  - `mode: 'subscription'`
  - `line_items`: monthly price ID or annual price ID (from env vars)
  - `success_url: /app/settings/billing?success=1`
  - `cancel_url: /app/settings/billing`
  - `customer`: existing Stripe customer ID
  - `allow_promotion_codes: true`
- Returns `{ url }` — client redirects to it

**`POST /api/billing/portal`** (`server/api/billing/portal.post.ts`):
- Requires auth, requires active subscription
- Creates a Stripe Customer Portal session for managing/cancelling
- Returns `{ url }` — client redirects to it

### Stripe webhook (`server/routes/webhooks/stripe.post.ts`)
- Verify signature with `STRIPE_WEBHOOK_SECRET`
- Handle events:
  - `checkout.session.completed` → update `stripeSubscriptionId`, `stripePriceId`, `billingInterval`, `subscriptionStatus = 'active'`
  - `customer.subscription.updated` → sync `subscriptionStatus`, `stripePriceId`, `billingInterval`
  - `customer.subscription.deleted` → set `subscriptionStatus = 'canceled'`, clear `stripePriceId`
  - `invoice.payment_failed` → set `subscriptionStatus = 'past_due'`

### New environment variables
```
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...
```
(Add to `.env.example` alongside existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`)

### Plan enforcement in existing routes

Apply `canAddLink` / `canAddAutomation` guards in the relevant API routes (tasks 004 and 007). Return HTTP 403 with `{ code: 'LIMIT_REACHED', limit, current }` when blocked. The client uses `code` to show the right upgrade prompt.

Apply `isAnalyticsBreakdownAllowed` in:
- `GET /api/links` — strip referrer/device/country from `link_clicks` aggregation for free users
- `GET /api/user/page/stats` — return only `total` for free users; omit breakdown arrays

### `/app/settings/billing` page

- Current plan badge (Free / Pro)
- Usage meters (progress bars at 80%+ turn amber, 100% turn red):
  - Links used / limit
  - Automations used / limit
  - DMs sent today / limit (Free only)
- **If Free**: two upgrade cards — Monthly ($9/mo) and Annual ($7/mo billed annually); clicking either calls `POST /api/billing/checkout`
- **If Pro**: "Manage subscription" button → calls `POST /api/billing/portal`; shows renewal date and billing interval
- `?success=1` query param shows a success toast on arrival

### Upgrade nudges

**Persistent nav badge (Free users only)**:
- Small "Free" chip next to the user avatar in the app shell nav (task 003)
- Clicking it opens a lightweight upgrade modal with the two plan cards

**Contextual upgrade prompt**:
- When an API returns `{ code: 'LIMIT_REACHED' }`, the client shows a modal: "You've reached your [links / automations] limit on the Free plan. Upgrade to Pro to get up to [limit]."
- When usage hits 80% of a limit, show a dismissible inline warning banner on the relevant page (`/app/links`, `/app/automations`)

## Acceptance criteria
- [ ] `shared/plans.ts` is the single source of truth for all limits
- [ ] Free users cannot create more than 10 links (API returns 403 at limit)
- [ ] Free users cannot create more than 1 automation (API returns 403 at limit)
- [ ] Free users see only total counts in analytics; breakdown is hidden
- [ ] Stripe Checkout redirects to the correct hosted page for monthly and annual
- [ ] Webhook correctly transitions `subscriptionStatus` for all four events
- [ ] Pro users see full analytics breakdown
- [ ] Pro users have limits of 1000 links and 20 automations enforced
- [ ] `/app/settings/billing` shows current plan, usage meters, and correct upgrade or manage CTA
- [ ] `?success=1` shows a success toast after checkout
- [ ] Free nav badge appears for free users; clicking it opens the upgrade modal
- [ ] Contextual upgrade modal appears when a limit is hit
- [ ] 80% usage triggers an amber warning banner on the relevant page
- [ ] Tests written: `getUserPlan` (active/trialing → pro, else → free), `canAddLink` / `canAddAutomation` (at limit, below limit, pro override), `isAnalyticsBreakdownAllowed`, Stripe webhook handler (all four events → correct DB state transitions)
- [ ] `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
