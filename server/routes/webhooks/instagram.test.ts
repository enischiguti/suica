import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const { verifyWebhookSignature } = await import('./instagram.post')

function makeSignature(body: Buffer, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  return `sha256=${hmac.digest('hex')}`
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret'
  const body = Buffer.from('{"test":"payload"}')

  it('returns true for valid signature', () => {
    const sig = makeSignature(body, secret)
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true)
  })

  it('returns false for tampered body', () => {
    const sig = makeSignature(body, secret)
    const tamperedBody = Buffer.from('{"tampered":"payload"}')
    expect(verifyWebhookSignature(tamperedBody, sig, secret)).toBe(false)
  })

  it('returns false for missing/empty signature', () => {
    expect(verifyWebhookSignature(body, '', secret)).toBe(false)
  })

  it('returns false for signature without sha256= prefix', () => {
    const hmac = createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature(body, hmac, secret)).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const sig = makeSignature(body, 'wrong-secret')
    expect(verifyWebhookSignature(body, sig, secret)).toBe(false)
  })
})
