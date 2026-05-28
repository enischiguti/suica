<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})
</script>

<template>
  <UContainer class="py-8">
    <UAlert
      title="Automations — coming soon"
      description="Instagram DM automations are on their way."
      icon="i-lucide-zap"
      color="neutral"
      variant="subtle"
    />
  </UContainer>
</template>
