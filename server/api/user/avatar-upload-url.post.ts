import { createError, defineEventHandler } from 'h3'
import { requireSession } from '~~/server/utils/session'

interface CloudflareDirectUploadResult {
  id: string
  uploadURL: string
}

interface CloudflareDirectUploadResponse {
  result: CloudflareDirectUploadResult | null
  success: boolean
  errors: { message: string }[]
}

function isCFResponse(v: unknown): v is CloudflareDirectUploadResponse {
  if (v === null || typeof v !== 'object')
    return false
  return 'success' in v && typeof Object.getOwnPropertyDescriptor(v, 'success')?.value === 'boolean'
}

function isCFResult(v: unknown): v is CloudflareDirectUploadResult {
  if (v === null || typeof v !== 'object')
    return false
  const id = Object.getOwnPropertyDescriptor(v, 'id')?.value
  const uploadURL = Object.getOwnPropertyDescriptor(v, 'uploadURL')?.value
  return typeof id === 'string' && typeof uploadURL === 'string'
}

export interface AvatarUploadConfig {
  cloudflareAccountId: string
  cloudflareImagesToken: string
  cloudflareImagesHash: string
}

export async function applyGetAvatarUploadUrl(config: AvatarUploadConfig) {
  const { cloudflareAccountId, cloudflareImagesToken } = config

  if (!cloudflareAccountId || !cloudflareImagesToken) {
    throw createError({ statusCode: 500, message: 'Cloudflare Images not configured' })
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v2/direct_upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareImagesToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  )

  if (!response.ok) {
    throw createError({ statusCode: 502, message: 'Failed to get upload URL from Cloudflare' })
  }

  const raw = await response.json()

  if (!isCFResponse(raw)) {
    throw createError({ statusCode: 502, message: 'Unexpected response from Cloudflare' })
  }

  if (!raw.success) {
    const msg = raw.errors[0]?.message ?? 'Unknown Cloudflare error'
    throw createError({ statusCode: 502, message: msg })
  }

  if (!isCFResult(raw.result)) {
    throw createError({ statusCode: 502, message: 'Missing upload URL from Cloudflare' })
  }

  return {
    uploadURL: raw.result.uploadURL,
    imageId: raw.result.id,
  }
}

export default defineEventHandler(async (event) => {
  await requireSession(event)
  const config = useRuntimeConfig()
  return applyGetAvatarUploadUrl({
    cloudflareAccountId: config.cloudflareAccountId,
    cloudflareImagesToken: config.cloudflareImagesToken,
    cloudflareImagesHash: config.cloudflareImagesHash,
  })
})
