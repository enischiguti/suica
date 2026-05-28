import { describe, expect, it } from 'vitest'
import { detectDevice } from '~~/server/utils/device'

describe('detectDevice', () => {
  it('returns "mobile" for a mobile user agent', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 10; SM-G975U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
    expect(detectDevice(ua)).toBe('mobile')
  })

  it('returns "tablet" for an iPad user agent', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    expect(detectDevice(ua)).toBe('tablet')
  })

  it('returns "tablet" for a generic tablet user agent', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 9; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36 Tablet'
    expect(detectDevice(ua)).toBe('tablet')
  })

  it('returns "desktop" for a desktop user agent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    expect(detectDevice(ua)).toBe('desktop')
  })

  it('returns "desktop" for an empty string', () => {
    expect(detectDevice('')).toBe('desktop')
  })

  it('returns "tablet" for Android tablet UA that contains both "mobile" and "tablet" keywords (tablet check first)', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 4.4.2; Tablet Build/KOT49H) Mobile Safari/537.36'
    expect(detectDevice(ua)).toBe('tablet')
  })
})
