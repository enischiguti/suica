import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the auth module
vi.mock('~~/server/utils/auth', () => ({
  useAuth: vi.fn(),
}))

const { useAuth } = await import('~~/server/utils/auth')
const { requireSession } = await import('~~/server/utils/session')

const mockUseAuth = vi.mocked(useAuth)

function makeEvent(): H3Event {
  // eslint-disable-next-line ts/consistent-type-assertions
  return { headers: new Headers() } as unknown as H3Event
}

describe('requireSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 401 when no session', async () => {
    const mockApi = { getSession: vi.fn().mockResolvedValue(null) }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseAuth.mockReturnValue({ api: mockApi } as unknown as ReturnType<typeof useAuth>)

    const event = makeEvent()
    await expect(requireSession(event)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Unauthorized',
    })
  })

  it('returns session when present', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      session: { id: 'session-1' },
    }
    const mockApi = { getSession: vi.fn().mockResolvedValue(mockSession) }
    // eslint-disable-next-line ts/consistent-type-assertions
    mockUseAuth.mockReturnValue({ api: mockApi } as unknown as ReturnType<typeof useAuth>)

    const event = makeEvent()
    const result = await requireSession(event)
    expect(result).toEqual(mockSession)
  })
})
