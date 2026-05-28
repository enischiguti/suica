<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const sessionState = authClient.useSession()

const featureCards = [
  {
    title: 'My Page',
    description: 'Your personal link page at su1.ca/username',
    icon: 'i-lucide-globe',
    to: '/app/page',
  },
  {
    title: 'My Links',
    description: 'Short links and analytics',
    icon: 'i-lucide-link',
    to: '/app/links',
  },
  {
    title: 'Automations',
    description: 'Instagram DM automations',
    icon: 'i-lucide-zap',
    to: '/app/automations',
  },
]
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <NuxtLink
        v-for="card in featureCards"
        :key="card.title"
        :to="card.to"
        class="block"
      >
        <UCard class="h-full hover:shadow-md transition-shadow cursor-pointer">
          <div class="flex flex-col items-center text-center gap-4 py-4">
            <UIcon
              :name="card.icon"
              class="text-primary size-10"
            />
            <div>
              <p class="font-semibold text-lg">
                {{ card.title }}
              </p>
              <p class="text-sm text-muted mt-1">
                {{ card.description }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <div class="text-center">
      <p class="text-xl font-semibold">
        Welcome back, {{ sessionState.data?.user?.name }}!
      </p>
    </div>
  </UContainer>
</template>
