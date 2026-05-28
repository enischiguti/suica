import process from 'node:process'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
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
    betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? '',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    analyticsSecret: process.env.ANALYTICS_SALT ?? '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    cloudflareImagesToken: process.env.CLOUDFLARE_IMAGES_TOKEN ?? '',
    cloudflareImagesHash: process.env.CLOUDFLARE_IMAGES_HASH ?? '',
    public: {
      cloudflareImagesHash: process.env.CLOUDFLARE_IMAGES_HASH ?? '',
    },
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET ?? '',
      },
      facebook: {
        clientId: process.env.NUXT_OAUTH_FACEBOOK_CLIENT_ID ?? '',
        clientSecret: process.env.NUXT_OAUTH_FACEBOOK_CLIENT_SECRET ?? '',
      },
    },
  },
})
