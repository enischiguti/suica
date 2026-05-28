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
Six feature cards in a 3-column grid (2-column on tablet, 1-column on mobile), two groups:

**Personal page**
- "Your links, your way" — Curate everything that matters in one shareable page
- "Your own URL" — Live at `su1.ca/username`, yours to customize
- "Share anything" — Links, social profiles, contact info, and more

**Instagram automation**
- "Auto-reply DMs" — Send a DM automatically when someone comments on your post
- "Set it and forget it" — Define rules once; Suica handles the rest 24/7
- "Grow on autopilot" — Convert comment engagement into real conversations

### Footer
- Copyright line: `© {year} Suica`
- Two text links: Privacy Policy (`/privacy`, stub route) and Terms of Service (`/terms`, stub route)

### General
- Fully responsive (mobile-first)
- No pricing section (planned for a later task)
- Page should be statically prerendered (`routeRules: { '/': { prerender: true } }` already set)

## Acceptance criteria
- [ ] `/` renders hero, features, and footer with correct copy
- [ ] "Get started free" navigates to `/login`
- [ ] Nuxt UI theme uses green primary and rose secondary
- [ ] Feature grid is responsive (3 cols desktop → 2 tablet → 1 mobile)
- [ ] Footer copyright year is dynamic
- [ ] `pnpm lint` and `pnpm typecheck` pass

## Notes
<!-- Agent scratchpad -->
