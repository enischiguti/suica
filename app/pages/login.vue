<script setup lang="ts">
definePageMeta({ layout: false })

const sessionState = authClient.useSession()

watch(sessionState, (state) => {
  if (state.data)
    navigateTo('/app')
}, { immediate: true })

const email = ref('')
const otp = ref('')
const step = ref<'email' | 'otp'>('email')
const loading = ref(false)
const error = ref('')

async function sendCode() {
  error.value = ''
  loading.value = true
  try {
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: email.value, type: 'sign-in' })
    if (err) {
      error.value = err.message ?? 'Failed to send code'
    }
    else {
      step.value = 'otp'
    }
  }
  catch {
    error.value = 'Failed to send code. Please try again.'
  }
  finally {
    loading.value = false
  }
}

async function verifyCode() {
  error.value = ''
  loading.value = true
  try {
    const { error: err } = await authClient.signIn.emailOtp({
      email: email.value,
      otp: otp.value,
      callbackURL: '/auth/callback',
    })
    if (err) {
      error.value = err.message ?? 'Invalid code'
    }
  }
  catch {
    error.value = 'Verification failed. Please try again.'
  }
  finally {
    loading.value = false
  }
}

async function signInWithGoogle() {
  await authClient.signIn.social({ provider: 'google', callbackURL: '/auth/callback' })
}

async function signInWithFacebook() {
  await authClient.signIn.social({ provider: 'facebook', callbackURL: '/auth/callback' })
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <UCard class="w-full max-w-md">
        <template #header>
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Suica
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sign in to continue
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <!-- OAuth Buttons -->
          <UButton
            block
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-simple-icons-google"
            @click="signInWithGoogle"
          >
            Continue with Google
          </UButton>

          <UButton
            block
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-simple-icons-facebook"
            @click="signInWithFacebook"
          >
            Continue with Facebook
          </UButton>

          <!-- Divider -->
          <div class="flex items-center gap-3 my-2">
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span class="text-sm text-gray-400 dark:text-gray-500">or</span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <!-- Email OTP Section -->
          <div v-if="error">
            <UAlert
              color="error"
              variant="soft"
              :description="error"
            />
          </div>

          <div v-if="step === 'email'" class="space-y-3">
            <UFormField label="Email address">
              <UInput
                v-model="email"
                type="email"
                placeholder="you@example.com"
                class="w-full"
                @keyup.enter="sendCode"
              />
            </UFormField>
            <UButton
              block
              size="lg"
              :loading="loading"
              :disabled="!email"
              @click="sendCode"
            >
              Send code
            </UButton>
          </div>

          <div v-else class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
              We sent a 6-digit code to <strong>{{ email }}</strong>
            </p>
            <UFormField label="Verification code">
              <UInput
                v-model="otp"
                type="text"
                placeholder="123456"
                maxlength="6"
                class="w-full"
                @keyup.enter="verifyCode"
              />
            </UFormField>
            <UButton
              block
              size="lg"
              :loading="loading"
              :disabled="otp.length !== 6"
              @click="verifyCode"
            >
              Verify
            </UButton>
            <UButton
              block
              size="sm"
              color="neutral"
              variant="ghost"
              @click="step = 'email'; otp = ''; error = ''"
            >
              Use a different email
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UApp>
</template>
