export function detectDevice(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad/i.test(userAgent))
    return 'tablet'

  if (/mobile|android/i.test(userAgent))
    return 'mobile'

  return 'desktop'
}
