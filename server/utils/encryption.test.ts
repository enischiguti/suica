import { describe, expect, it, vi } from 'vitest'

// Stub useRuntimeConfig with a valid 32-byte hex key (64 hex chars)
const TEST_KEY = '0'.repeat(64)
vi.stubGlobal('useRuntimeConfig', () => ({ encryptionKey: TEST_KEY }))

const { encryptToken, decryptToken } = await import('./encryption')

describe('encryption', () => {
  it('round-trip: decryptToken(encryptToken(original)) === original', () => {
    const original = 'my-super-secret-access-token'
    const encrypted = encryptToken(original)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(original)
  })

  it('produces different ciphertexts on each call (different IVs)', () => {
    const token = 'same-token'
    const enc1 = encryptToken(token)
    const enc2 = encryptToken(token)
    expect(enc1).not.toBe(enc2)
  })

  it('encrypted format is iv:ciphertext (both hex)', () => {
    const encrypted = encryptToken('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/) // 16 bytes = 32 hex chars
  })

  it('throws on malformed ciphertext', () => {
    expect(() => decryptToken('notvalidformat')).toThrow()
  })
})
