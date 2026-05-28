export const PLANS = {
  free: {
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    limits: {
      links: 10,
      automations: 1,
      dmsPerDay: 100,
      analyticsBreakdown: false,
    },
  },
  pro: {
    name: 'Pro',
    price: { monthly: 9, annual: 7 },
    limits: {
      links: 1000,
      automations: 20,
      dmsPerDay: null,
      analyticsBreakdown: true,
    },
  },
} as const
