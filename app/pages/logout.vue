<script setup lang="ts">
onMounted(async () => {
  await authClient.signOut()
  navigateTo('/')
})
</script>

<template>
  <div />
</template>
