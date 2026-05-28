import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()
const mockReturning = vi.fn()

vi.mock('~~/server/db/index', () => ({
  useDB: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('~~/server/utils/slug', () => ({
  isValidSlug: vi.fn((s: string) => /^[a-z0-9-]+$/.test(s) && s.length >= 1 && s.length <= 64),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq-result'), and: vi.fn(() => 'and-result') }
})

const { applyUpdateLink } = await import('./[id].patch')

interface MockLink {
  id: string
  userId: string
  title: string
  destinationUrl: string
  slug: string
  showOnPage: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const sampleLink: MockLink = {
  id: 'link-1',
  userId: 'user-1',
  title: 'Test Link',
  destinationUrl: 'https://example.com',
  slug: 'test-link',
  showOnPage: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

let selectCallCount = 0

function setupSelectSequence(responses: unknown[][]) {
  selectCallCount = 0
  mockLimit.mockImplementation(() => {
    const response = responses[selectCallCount] ?? []
    selectCallCount++
    return Promise.resolve(response)
  })
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateReturns(row: unknown) {
  mockReturning.mockResolvedValue(row ? [row] : [])
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

describe('applyUpdateLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallCount = 0
  })

  it('throws 404 when link is not found', async () => {
    setupSelectSequence([[]])
    await expect(
      applyUpdateLink('nonexistent', 'user-1', { title: 'New Title' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when user does not own the link', async () => {
    setupSelectSequence([[sampleLink]])
    await expect(
      applyUpdateLink('link-1', 'other-user', { title: 'New Title' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('updates link and returns updated link for valid payload', async () => {
    const updatedLink = { ...sampleLink, title: 'Updated Title' }
    setupSelectSequence([[sampleLink]])
    setupUpdateReturns(updatedLink)

    const result = await applyUpdateLink('link-1', 'user-1', { title: 'Updated Title' })
    expect(result).toMatchObject({ title: 'Updated Title' })
  })

  it('throws 409 when new slug conflicts with existing link', async () => {
    setupSelectSequence([[sampleLink], [{ id: 'other' }]])
    await expect(
      applyUpdateLink('link-1', 'user-1', { slug: 'taken-slug' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('allows updating showOnPage to false', async () => {
    const updatedLink = { ...sampleLink, showOnPage: false }
    setupSelectSequence([[sampleLink]])
    setupUpdateReturns(updatedLink)

    const result = await applyUpdateLink('link-1', 'user-1', { showOnPage: false })
    expect(result).toMatchObject({ showOnPage: false })
  })

  it('allows deactivating a link', async () => {
    const updatedLink = { ...sampleLink, isActive: false }
    setupSelectSequence([[sampleLink]])
    setupUpdateReturns(updatedLink)

    const result = await applyUpdateLink('link-1', 'user-1', { isActive: false })
    expect(result).toMatchObject({ isActive: false })
  })
})
