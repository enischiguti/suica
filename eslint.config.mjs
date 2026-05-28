import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  markdown: false,
  rules: {
    'ts/no-non-null-assertion': 'error',
    'ts/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    'ts/no-restricted-imports': ['error', {
      patterns: [{
        regex: '^\\.{1,2}/',
        message: 'Use path aliases (~~, ~) instead of relative imports',
      }],
    }],
  },
})
