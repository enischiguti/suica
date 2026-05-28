<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
})

useSeoMeta({
  title: 'Suica — Your internet presence, simplified',
  description: 'Create your personal link page and automate your Instagram DMs — all in one place. Free to start.',
  ogTitle: 'Suica — Your internet presence, simplified',
  ogDescription: 'Create your personal link page and automate your Instagram DMs — all in one place. Free to start.',
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
