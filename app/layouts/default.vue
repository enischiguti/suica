<script setup lang="ts">
const year = getCurrentYear()
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="font-bold text-xl tracking-tight text-primary flex items-center gap-1"
          aria-label="Suica home"
        >
          <span class="text-2xl" aria-hidden="true">🍉</span>
          <span>Suica</span>
        </NuxtLink>
      </template>

      <template #body>
        <UNavigationMenu
          :items="[{ label: 'Pricing', to: '/#pricing' }]"
          orientation="horizontal"
        />
      </template>

      <template #right>
        <UButton
          to="/login"
          label="Log in"
          color="neutral"
          variant="ghost"
        />
        <UButton
          to="/login"
          label="Get started free"
          color="primary"
          class="hidden sm:flex"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          &copy; {{ year }} Suica
        </p>
      </template>

      <template #right>
        <UButton
          to="/privacy"
          label="Privacy Policy"
          color="neutral"
          variant="ghost"
          size="sm"
        />
        <UButton
          to="/terms"
          label="Terms of Service"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </template>
    </UFooter>
  </UApp>
</template>
