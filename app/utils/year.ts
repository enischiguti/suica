/**
 * Returns the current calendar year as a number.
 * Isolated for testability.
 */
export function getCurrentYear(): number {
  return new Date().getFullYear()
}
