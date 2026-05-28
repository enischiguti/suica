import { defineEventHandler, getValidatedQuery, sendRedirect } from 'h3'
import { z } from 'zod'
import { useDB } from '~~/server/db/index'
import { instagramAccounts } from '~~/server/db/schema'
import { encryptToken } from '~~/server/utils/encryption'

const querySchema = z.object({
  code: z.string(),
  state: z.string(),
})

const shortLivedTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
})

const longLivedTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().optional(),
})

const igUserSchema = z.object({
  id: z.string(),
  username: z.string(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { code, state: userId } = await getValidatedQuery(event, querySchema.parse)
  const callbackUrl = `${config.public.baseUrl}/instagram/callback`

  // Exchange code for short-lived token
  const shortLivedParams = new URLSearchParams({
    client_id: config.instagramAppId,
    client_secret: config.instagramAppSecret,
    redirect_uri: callbackUrl,
    code,
    grant_type: 'authorization_code',
  })

  const shortLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${shortLivedParams.toString()}`)
  const shortLivedData = shortLivedTokenSchema.parse(await shortLivedRes.json())

  // Exchange short-lived for long-lived token
  const longLivedParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: config.instagramAppId,
    client_secret: config.instagramAppSecret,
    fb_exchange_token: shortLivedData.access_token,
  })

  const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${longLivedParams.toString()}`)
  const longLivedData = longLivedTokenSchema.parse(await longLivedRes.json())

  // Fetch IG user
  const igUserRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,username&access_token=${longLivedData.access_token}`)
  const igUser = igUserSchema.parse(await igUserRes.json())

  const encryptedToken = encryptToken(longLivedData.access_token)
  const tokenExpiresAt = longLivedData.expires_in
    ? new Date(Date.now() + longLivedData.expires_in * 1000)
    : null

  const db = useDB()
  const id = crypto.randomUUID()

  await db.insert(instagramAccounts).values({
    id,
    userId,
    igUserId: igUser.id,
    igUsername: igUser.username,
    accessToken: encryptedToken,
    tokenExpiresAt,
    connectedAt: new Date(),
  }).onConflictDoUpdate({
    target: instagramAccounts.userId,
    set: {
      igUserId: igUser.id,
      igUsername: igUser.username,
      accessToken: encryptedToken,
      tokenExpiresAt,
      connectedAt: new Date(),
    },
  })

  return sendRedirect(event, '/app/automations')
})
