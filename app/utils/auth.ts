import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: '/',
  plugins: [
    inferAdditionalFields({
      user: {
        username: { type: 'string', required: false, defaultValue: null },
        useCase: { type: 'string', required: false, defaultValue: null },
        avatarUrl: { type: 'string', required: false, defaultValue: null },
      },
    }),
    emailOTPClient(),
  ],
})
