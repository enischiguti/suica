export type Theme = 'default' | 'midnight' | 'rose' | 'forest'

export const THEMES: Record<Theme, { bg: string, cardBg: string, text: string, button: string }> = {
  default: { bg: 'bg-white', cardBg: 'bg-gray-50', text: 'text-gray-900', button: 'bg-green-600 text-white hover:bg-green-700' },
  midnight: { bg: 'bg-gray-950', cardBg: 'bg-gray-900', text: 'text-white', button: 'bg-rose-500 text-white hover:bg-rose-600' },
  rose: { bg: 'bg-rose-50', cardBg: 'bg-rose-100', text: 'text-gray-900', button: 'bg-green-600 text-white hover:bg-green-700' },
  forest: { bg: 'bg-green-950', cardBg: 'bg-green-900', text: 'text-white', button: 'bg-rose-500 text-white hover:bg-rose-600' },
}
