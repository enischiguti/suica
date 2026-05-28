import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function useStripe(): Stripe {
  if (!_stripe)
    _stripe = new Stripe(useRuntimeConfig().stripeSecretKey)
  return _stripe
}
