import { describe, expect, it } from 'vitest'
import { isReservedUsername, isValidUsernameFormat, RESERVED_USERNAMES, USERNAME_REGEX } from '~/utils/username'

describe('username regex', () => {
  it('allows lowercase letters', () => {
    expect(USERNAME_REGEX.test('hello')).toBe(true)
  })

  it('allows numbers', () => {
    expect(USERNAME_REGEX.test('user123')).toBe(true)
  })

  it('allows underscores and hyphens', () => {
    expect(USERNAME_REGEX.test('user_name-123')).toBe(true)
  })

  it('rejects uppercase letters', () => {
    expect(USERNAME_REGEX.test('Hello')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(USERNAME_REGEX.test('hello world')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(USERNAME_REGEX.test('user@name')).toBe(false)
  })

  it('rejects too short username (< 3 chars)', () => {
    expect(USERNAME_REGEX.test('ab')).toBe(false)
  })

  it('rejects too long username (> 32 chars)', () => {
    expect(USERNAME_REGEX.test('a'.repeat(33))).toBe(false)
  })

  it('allows exactly 3 characters', () => {
    expect(USERNAME_REGEX.test('abc')).toBe(true)
  })

  it('allows exactly 32 characters', () => {
    expect(USERNAME_REGEX.test('a'.repeat(32))).toBe(true)
  })
})

describe('reserved usernames list', () => {
  it('contains expected reserved names', () => {
    expect(RESERVED_USERNAMES).toContain('admin')
    expect(RESERVED_USERNAMES).toContain('api')
    expect(RESERVED_USERNAMES).toContain('auth')
    expect(RESERVED_USERNAMES).toContain('login')
    expect(RESERVED_USERNAMES).toContain('billing')
  })
})

describe('isValidUsernameFormat', () => {
  it('returns true for valid username', () => {
    expect(isValidUsernameFormat('johndoe')).toBe(true)
  })

  it('returns false for invalid username', () => {
    expect(isValidUsernameFormat('John Doe!')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidUsernameFormat('')).toBe(false)
  })
})

describe('isReservedUsername', () => {
  it('returns true for reserved username', () => {
    expect(isReservedUsername('admin')).toBe(true)
    expect(isReservedUsername('api')).toBe(true)
  })

  it('returns true case-insensitively', () => {
    expect(isReservedUsername('ADMIN')).toBe(true)
    expect(isReservedUsername('Admin')).toBe(true)
  })

  it('returns false for non-reserved username', () => {
    expect(isReservedUsername('johndoe')).toBe(false)
  })
})
