<script setup lang="ts">
const sessionState = authClient.useSession()
const { state: upgradeState, showUpgradePrompt, closeUpgradePrompt } = useUpgradePrompt()

const userInitials = computed(() => {
  const name = sessionState.value.data?.user?.name
  if (!name)
    return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase()
})

const dropdownItems = [
  [
    {
      label: 'Account',
      icon: 'i-lucide-settings',
      to: '/app/settings',
    },
    {
      label: 'Billing',
      icon: 'i-lucide-credit-card',
      to: '/app/settings/billing',
    },
  ],
  [
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        await authClient.signOut()
        await navigateTo('/')
      },
    },
  ],
]

interface BillingData {
  plan: 'free' | 'pro'
}

const { data: billingData } = await useFetch<BillingData>('/api/user/billing')
const isFree = computed(() => billingData.value?.plan === 'free')

const isUpgradeModalOpen = computed({
  get: () => upgradeState.value.open,
  set: (val: boolean) => {
    if (!val)
      closeUpgradePrompt()
  },
})

const isCheckingOut = ref(false)

async function startCheckout(interval: 'monthly' | 'annual') {
  isCheckingOut.value = true
  try {
    const { url } = await $fetch<{ url: string | null }>('/api/billing/checkout', {
      method: 'POST',
      body: { interval },
    })
    if (url) {
      window.location.href = url
    }
  }
  catch {
    isCheckingOut.value = false
  }
}
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/app"
          class="font-bold text-xl tracking-tight text-primary flex items-center gap-1"
          aria-label="Suica dashboard"
        >
          <span
            class="text-2xl"
            aria-hidden="true"
          >🍉</span>
          <span>Suica</span>
        </NuxtLink>
      </template>

      <template #right>
        <div class="flex items-center gap-2">
          <!-- Free badge — click to upgrade -->
          <UBadge
            v-if="isFree"
            color="neutral"
            variant="subtle"
            class="cursor-pointer hover:opacity-80 transition-opacity"
            @click="showUpgradePrompt('Upgrade to Pro for more links, automations, and no daily DM cap.')"
          >
            Free
          </UBadge>

          <UDropdownMenu :items="dropdownItems">
            <UButton
              variant="ghost"
              color="neutral"
              class="flex items-center gap-2 px-2"
              aria-label="User menu"
            >
              <UAvatar
                :src="sessionState.data?.user?.avatarUrl ?? undefined"
                :alt="sessionState.data?.user?.name ?? 'User'"
                :text="userInitials"
                size="sm"
              />
              <span class="hidden sm:inline text-sm font-medium">
                {{ sessionState.data?.user?.name }}
              </span>
            </UButton>
          </UDropdownMenu>
        </div>
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <!-- Upgrade modal -->
    <UModal
      v-model:open="isUpgradeModalOpen"
      title="Upgrade to Pro"
    >
      <template #body>
        <div class="space-y-4">
          <p
            v-if="upgradeState.message"
            class="text-muted text-sm"
          >
            {{ upgradeState.message }}
          </p>
          <p class="text-sm text-muted">
            Unlock more links, automations, and remove the daily DM cap.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <!-- Monthly -->
            <UCard class="border border-neutral-200 dark:border-neutral-700">
              <div class="space-y-3 text-center">
                <p class="font-semibold">
                  Monthly
                </p>
                <div>
                  <span class="text-2xl font-bold">$9</span>
                  <span class="text-muted text-sm">/mo</span>
                </div>
                <UButton
                  size="sm"
                  class="w-full"
                  variant="outline"
                  :loading="isCheckingOut"
                  @click="startCheckout('monthly')"
                >
                  Choose monthly
                </UButton>
              </div>
            </UCard>

            <!-- Annual -->
            <UCard class="border-2 border-primary">
              <div class="space-y-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <p class="font-semibold">
                    Annual
                  </p>
                  <UBadge
                    color="success"
                    size="xs"
                  >
                    Best value
                  </UBadge>
                </div>
                <div>
                  <span class="text-2xl font-bold">$7</span>
                  <span class="text-muted text-sm">/mo</span>
                </div>
                <UButton
                  size="sm"
                  class="w-full"
                  :loading="isCheckingOut"
                  @click="startCheckout('annual')"
                >
                  Choose annual
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="ghost"
            @click="closeUpgradePrompt"
          >
            Maybe later
          </UButton>
        </div>
      </template>
    </UModal>
  </UApp>
</template>
