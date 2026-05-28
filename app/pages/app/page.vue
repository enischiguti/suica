<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})
</script>

<template>
  <UContainer class="py-8">
    <UAlert
      title="My Page — coming soon"
      description="Your personal link page feature is on its way."
      icon="i-lucide-globe"
      color="neutral"
      variant="subtle"
    />
  </UContainer>
</template>
