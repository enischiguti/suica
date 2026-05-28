export const USERNAME_REGEX = /^[a-z0-9_-]{3,32}$/

export const RESERVED_USERNAMES = [
  'app',
  'api',
  'auth',
  'login',
  'logout',
  'onboarding',
  'webhooks',
  'privacy',
  'terms',
  'instagram',
  'static',
  'cdn',
  'admin',
  'support',
  'help',
  'billing',
]

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_REGEX.test(username)
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase())
}
