import { createHmac } from 'node:crypto'
import { defineEventHandler, sendRedirect } from 'h3'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const config = useRuntimeConfig()
  const userId = session.user.id
  const sig = createHmac('sha256', config.betterAuthSecret).update(userId).digest('hex')
  const state = `${userId}.${sig}`
  const callbackUrl = `${config.public.baseUrl}/instagram/callback`
  const params = new URLSearchParams({
    client_id: config.instagramAppId,
    redirect_uri: callbackUrl,
    scope: 'instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging',
    response_type: 'code',
    state,
  })
  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  return sendRedirect(event, url)
})
