import { defineEventHandler, sendRedirect } from 'h3'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const config = useRuntimeConfig()
  const callbackUrl = `${config.public.baseUrl}/instagram/callback`
  const params = new URLSearchParams({
    client_id: config.instagramAppId,
    redirect_uri: callbackUrl,
    scope: 'instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging',
    response_type: 'code',
    state: session.user.id,
  })
  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  return sendRedirect(event, url)
})
