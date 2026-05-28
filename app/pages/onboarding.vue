<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const sessionState = authClient.useSession()

// Redirect if already onboarded
watch(sessionState, (state) => {
  const user = state.data?.user
  if (!user)
    return
  // Check additional fields that better-auth doesn't include in base type
  if ('username' in user && 'useCase' in user && user.username && user.useCase) {
    navigateTo('/app')
  }
}, { immediate: true })

const step = ref<1 | 2>(1)
const username = ref('')
const selectedUseCase = ref<'personal-page' | 'instagram-automation' | null>(null)

const usernameError = ref('')
const usernameAvailable = ref<boolean | null>(null)
const checkingUsername = ref(false)
const submitting = ref(false)
const submitError = ref('')

function extractErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object')
    return 'Something went wrong. Please try again.'
  if (!('data' in err))
    return 'Something went wrong. Please try again.'
  const errData = err.data
  if (!errData || typeof errData !== 'object')
    return 'Something went wrong'
  if (!('message' in errData))
    return 'Something went wrong'
  const msg = errData.message
  return typeof msg === 'string' ? (msg || 'Something went wrong') : 'Something went wrong'
}

const useCaseOptions = [
  {
    value: 'personal-page' as const,
    icon: 'i-lucide-globe',
    label: 'Personal page',
    description: 'Create your link page at su1.ca/username',
  },
  {
    value: 'instagram-automation' as const,
    icon: 'i-lucide-zap',
    label: 'Instagram automation',
    description: 'Auto-send DMs when someone comments on your post',
  },
]

const { USERNAME_REGEX, RESERVED_USERNAMES } = await import('~/utils/username')

function validateUsernameLocally(name: string): string {
  if (!name)
    return ''
  if (!USERNAME_REGEX.test(name))
    return 'Username must be 3–32 characters: lowercase letters, numbers, _ or -'
  if (RESERVED_USERNAMES.includes(name))
    return 'Username not available'
  return ''
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(username, (val) => {
  usernameAvailable.value = null
  const localError = validateUsernameLocally(val)
  usernameError.value = localError

  if (localError || !val)
    return

  if (debounceTimer)
    clearTimeout(debounceTimer)
  checkingUsername.value = true
  debounceTimer = setTimeout(async () => {
    try {
      const data = await $fetch<{ available: boolean }>('/api/user/check-username', {
        query: { username: val },
      })
      usernameAvailable.value = data.available
      if (!data.available) {
        usernameError.value = 'Username not available'
      }
    }
    catch {
      usernameError.value = 'Could not check username availability'
    }
    finally {
      checkingUsername.value = false
    }
  }, 400)
})

const usernameValid = computed(() => {
  return !usernameError.value && usernameAvailable.value === true && !checkingUsername.value
})

async function submitOnboarding() {
  if (!selectedUseCase.value || !username.value)
    return
  submitError.value = ''
  submitting.value = true
  try {
    await $fetch('/api/onboarding', {
      method: 'POST',
      body: { username: username.value, useCase: selectedUseCase.value },
    })
    await navigateTo('/app')
  }
  catch (err: unknown) {
    submitError.value = extractErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <UCard class="w-full max-w-lg">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Set up your account
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Step {{ step }} of 2
          </p>
        </div>
      </template>

      <!-- Step 1: Username -->
      <div v-if="step === 1" class="space-y-4">
        <UFormField
          label="Choose your username"
          :error="usernameError"
        >
          <UInput
            v-model="username"
            placeholder="yourname"
            class="w-full"
            :trailing-icon="checkingUsername ? 'i-lucide-loader-circle' : undefined"
          />
        </UFormField>

        <div v-if="username && !usernameError && !checkingUsername && usernameAvailable === true" class="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
          <UIcon name="i-lucide-check-circle" />
          Username available
        </div>

        <p v-if="username && !usernameError" class="text-sm text-gray-500 dark:text-gray-400">
          Your page will be at <strong>su1.ca/{{ username }}</strong>
        </p>

        <UButton
          block
          size="lg"
          :disabled="!usernameValid"
          @click="step = 2"
        >
          Next
        </UButton>
      </div>

      <!-- Step 2: Use case -->
      <div v-else class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">
          What will you use Suica for?
        </p>

        <div class="grid gap-3">
          <UCard
            v-for="option in useCaseOptions"
            :key="option.value"
            class="cursor-pointer transition-all"
            :class="selectedUseCase === option.value ? 'ring-2 ring-primary-500' : 'hover:border-gray-300'"
            @click="selectedUseCase = option.value"
          >
            <div class="flex items-start gap-3">
              <UIcon :name="option.icon" class="text-2xl text-primary-500 mt-0.5" />
              <div>
                <p class="font-semibold text-gray-900 dark:text-white">
                  {{ option.label }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ option.description }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <UAlert
          v-if="submitError"
          color="error"
          variant="soft"
          :description="submitError"
        />

        <div class="flex gap-3">
          <UButton
            color="neutral"
            variant="outline"
            @click="step = 1"
          >
            Back
          </UButton>
          <UButton
            class="flex-1"
            size="lg"
            :loading="submitting"
            :disabled="!selectedUseCase"
            @click="submitOnboarding"
          >
            Finish
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
