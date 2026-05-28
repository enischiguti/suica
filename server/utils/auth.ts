import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { useDB } from '~~/server/db/index'

function createAuth() {
  return betterAuth({
    secret: useRuntimeConfig().betterAuthSecret,
    baseURL: useRuntimeConfig().betterAuthUrl,
    database: drizzleAdapter(useDB(), { provider: 'pg' }),
    emailAndPassword: { enabled: false },
    plugins: [
      emailOTP({
        sendVerificationOTP: async ({ email, otp }: { email: string, otp: string }) => {
          await sendMail({
            to: email,
            subject: 'Your Suica login code',
            html: `<p>Your code: <strong>${otp}</strong></p>`,
          })
        },
        otpLength: 6,
        expiresIn: 600,
      }),
    ],
    socialProviders: {
      google: {
        clientId: useRuntimeConfig().oauth.google.clientId,
        clientSecret: useRuntimeConfig().oauth.google.clientSecret,
      },
      facebook: {
        clientId: useRuntimeConfig().oauth.facebook.clientId,
        clientSecret: useRuntimeConfig().oauth.facebook.clientSecret,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'facebook'],
      },
    },
    user: {
      additionalFields: {
        username: { type: 'string', required: false, defaultValue: null },
        useCase: { type: 'string', required: false, defaultValue: null },
        avatarUrl: { type: 'string', required: false, defaultValue: null },
      },
    },
  })
}

type AuthInstance = ReturnType<typeof createAuth>
let _auth: AuthInstance | undefined

export function useAuth(): AuthInstance {
  if (!_auth)
    _auth = createAuth()
  return _auth
}
