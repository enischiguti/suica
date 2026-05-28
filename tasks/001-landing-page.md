# 001 — Landing page

## Goal
Build the public-facing landing page at `/`. Suica means "watermelon" in Japanese — the visual identity is light, clean, and minimal with green (primary) and rose (secondary) as brand colors. The page introduces two use cases: a linktr.ee-style personal page and an Instagram DM automation tool.

## Specs

### Theme
- Configure Nuxt UI theme in `app/app.config.ts`: primary color `green`, secondary color `rose`
- Light mode, clean and airy aesthetic

### Layout / Header
- Sticky top navigation bar with the Suica logo/wordmark on the left
- "Log in" button on the right linking to `/login`

### Hero section
- Headline: "Your internet presence, simplified"
- Subheadline: "Create your personal link page and automate your Instagram DMs — all in one place. Free to start."
- Primary CTA: "Get started free" → `/login`
- Secondary CTA: "See how it works" → smooth scroll to `#features`
- Subtle watermelon-inspired decorative element (green + rose accent, SVG or emoji, keep it tasteful)

### Features section (`id="features"`)
Nine feature cards in a 3-column grid (2-column on tablet, 1-column on mobile), three groups with a labelled group heading above each row:

**Personal page**
- "Your links, your way" — Curate everything that matters in one shareable page
- "Your own URL" — Live at `su1.ca/username`, yours to customize
- "Share anything" — Links, social profiles, contact info, and more

**Short links**
- "Your personal URL shortener" — Create short links at `su1.ca/username/anything` in seconds
- "Edit the destination anytime" — Change where a link points without touching the URL
- "See who's clicking" — Track clicks, referrers, devices, and countries per link

**Instagram automation**
- "Auto-reply DMs" — Send a DM automatically when someone comments on your post
- "Set it and forget it" — Define rules once; Suica handles the rest 24/7
- "Grow on autopilot" — Convert comment engagement into real conversations

### Pricing section (`id="pricing"`)
Two-column plan cards, centered, between features and footer. "Most popular" badge on Pro.

**Free — $0/mo**
- Personal link page at `su1.ca/username`
- Up to 10 short links
- 1 Instagram automation
- Up to 100 DMs/day
- Basic analytics (click count and total page visits only)
- CTA: "Get started free" → `/login`

**Pro — $9/mo or $7/mo billed annually**
- Everything in Free
- Up to 1,000 short links
- Up to 20 Instagram automations
- Instagram DM limit (200/hr, platform maximum)
- Full analytics (referrer, device, country breakdown)
- CTA: "Get Pro" → `/login` (Stripe Checkout handled post-login, in task 008)

Add "Pricing" link to the landing page nav bar linking to `#pricing`.
Add "See pricing" as a tertiary link in the hero alongside the two existing CTAs.

### Footer
- Copyright line: `© {year} Suica`
- Two text links: Privacy Policy (`/privacy`, stub route) and Terms of Service (`/terms`, stub route)

### General
- Fully responsive (mobile-first)
- Page should be statically prerendered (`routeRules: { '/': { prerender: true } }` already set)

## Acceptance criteria
- [ ] `/` renders hero, features, and footer with correct copy
- [ ] "Get started free" navigates to `/login`
- [ ] Nuxt UI theme uses green primary and rose secondary
- [ ] All three feature groups render with their group headings
- [ ] Feature grid is responsive (3 cols desktop → 2 tablet → 1 mobile)
- [ ] Pricing section renders Free and Pro cards with correct limits and CTAs
- [ ] Nav has a "Pricing" link scrolling to `#pricing`
- [ ] Footer copyright year is dynamic
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
