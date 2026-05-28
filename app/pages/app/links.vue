<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})
</script>

<template>
  <UContainer class="py-8">
    <UAlert
      title="My Links — coming soon"
      description="Short links and analytics are on their way."
      icon="i-lucide-link"
      color="neutral"
      variant="subtle"
    />
  </UContainer>
</template>
