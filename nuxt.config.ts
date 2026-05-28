import process from 'node:process'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-auth-utils',
  ],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    mailgunApiKey: process.env.MAILGUN_API_KEY ?? '',
    mailgunDomain: process.env.MAILGUN_DOMAIN ?? '',
    session: {
      password: process.env.NUXT_SESSION_PASSWORD ?? '',
    },
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET ?? '',
      },
      github: {
        clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET ?? '',
      },
    },
  },
})
