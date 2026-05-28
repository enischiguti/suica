import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Session mock ---
const mockRequireSession = vi.fn()
vi.mock('~~/server/utils/session', () => ({
  requireSession: mockRequireSession,
}))

const { applyGetAvatarUploadUrl } = await import('./avatar-upload-url.post')

const MOCK_TOKEN = 'super-secret-cloudflare-token'
const MOCK_ACCOUNT_ID = 'cf-account-123'

describe('applyGetAvatarUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns uploadURL and imageId without exposing the CF token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          id: 'image-abc-123',
          uploadURL: 'https://upload.imagedelivery.net/direct-upload-url',
        },
        errors: [],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await applyGetAvatarUploadUrl({
      cloudflareAccountId: MOCK_ACCOUNT_ID,
      cloudflareImagesToken: MOCK_TOKEN,
      cloudflareImagesHash: 'hash-xyz',
    })

    expect(result.uploadURL).toBe('https://upload.imagedelivery.net/direct-upload-url')
    expect(result.imageId).toBe('image-abc-123')

    // Ensure the token is NOT in the response
    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain(MOCK_TOKEN)
  })

  it('throws 500 when cloudflareAccountId is not configured', async () => {
    await expect(
      applyGetAvatarUploadUrl({
        cloudflareAccountId: '',
        cloudflareImagesToken: MOCK_TOKEN,
        cloudflareImagesHash: '',
      }),
    ).rejects.toMatchObject({ statusCode: 500 })
  })

  it('throws 500 when cloudflareImagesToken is not configured', async () => {
    await expect(
      applyGetAvatarUploadUrl({
        cloudflareAccountId: MOCK_ACCOUNT_ID,
        cloudflareImagesToken: '',
        cloudflareImagesHash: '',
      }),
    ).rejects.toMatchObject({ statusCode: 500 })
  })

  it('throws 502 when Cloudflare API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(
      applyGetAvatarUploadUrl({
        cloudflareAccountId: MOCK_ACCOUNT_ID,
        cloudflareImagesToken: MOCK_TOKEN,
        cloudflareImagesHash: 'hash-xyz',
      }),
    ).rejects.toMatchObject({ statusCode: 502 })
  })

  it('throws 502 when Cloudflare API returns success=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        result: null,
        errors: [{ message: 'Invalid token' }],
      }),
    }))

    await expect(
      applyGetAvatarUploadUrl({
        cloudflareAccountId: MOCK_ACCOUNT_ID,
        cloudflareImagesToken: MOCK_TOKEN,
        cloudflareImagesHash: 'hash-xyz',
      }),
    ).rejects.toMatchObject({ statusCode: 502 })
  })

  it('requires auth (401 if no session)', async () => {
    mockRequireSession.mockRejectedValue({ statusCode: 401, message: 'Unauthorized' })

    const mod = await import('./avatar-upload-url.post')
    const handler = mod.default

    // eslint-disable-next-line ts/consistent-type-assertions
    await expect(handler({} as unknown as Parameters<typeof handler>[0])).rejects.toMatchObject({ statusCode: 401 })
  })
})
