import { createError, defineEventHandler, getValidatedQuery, send } from 'h3'
import { z } from 'zod'

const querySchema = z.object({
  'hub.mode': z.string(),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const config = useRuntimeConfig()

  if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== config.instagramWebhookSecret) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return send(event, query['hub.challenge'], 'text/plain')
})
