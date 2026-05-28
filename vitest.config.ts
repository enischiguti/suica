import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '~~': resolve(__dirname),
      'h3': resolve(__dirname, 'node_modules/.pnpm/h3@1.15.11/node_modules/h3/dist/index.mjs'),
      'nitropack/types': resolve(__dirname, 'node_modules/.pnpm/nitropack@2.13.4_drizzle-orm@0.44.7_postgres@3.4.9__oxc-parser@0.131.0_srvx@0.11.16/node_modules/nitropack/dist/types/index.d.ts'),
    },
  },
  test: {
    environment: 'node',
  },
})
