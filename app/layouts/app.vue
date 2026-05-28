<script setup lang="ts">
const sessionState = authClient.useSession()

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
          <span class="text-2xl" aria-hidden="true">🍉</span>
          <span>Suica</span>
        </NuxtLink>
      </template>

      <template #right>
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
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>
  </UApp>
</template>
