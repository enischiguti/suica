import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  rules: {
    'ts/no-non-null-assertion': 'error',
    'ts/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  },
})
