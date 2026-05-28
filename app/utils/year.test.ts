import { describe, expect, it } from 'vitest'
import { getCurrentYear } from '~/utils/year'

describe('getCurrentYear', () => {
  it('returns the current year as a number', () => {
    const year = getCurrentYear()
    expect(typeof year).toBe('number')
    expect(year).toBeGreaterThanOrEqual(2024)
  })

  it('matches new Date().getFullYear()', () => {
    expect(getCurrentYear()).toBe(new Date().getFullYear())
  })
})
