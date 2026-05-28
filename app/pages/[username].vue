<script setup lang="ts">
import type { Theme } from '~/utils/themes'
import { THEMES } from '~/utils/themes'

definePageMeta({ layout: false })

interface Social {
  platform: string
  url: string
}

interface LinkItem {
  id: string
  title: string
  destinationUrl: string
  slug: string
  showOnPage: boolean
  isActive: boolean
  createdAt: string
}

interface PublicProfile {
  user: {
    name: string | null
    username: string | null
    avatarUrl: string | null
  }
  profile: {
    bio: string | null
    theme: string | null
    socials: Social[] | null
    customAvatarUrl: string | null
    effectiveAvatarUrl: string | null
  }
  links: LinkItem[]
}

const route = useRoute()
const usernameParam = route.params.username
const username = Array.isArray(usernameParam) ? (usernameParam[0] ?? '') : (usernameParam ?? '')

const { data, error } = await useAsyncData<PublicProfile>(
  `public-profile-${username}`,
  () => $fetch(`/api/public/${username}`),
)

if (error.value) {
  throw createError({ statusCode: 404, message: 'Page not found' })
}

const profile = computed(() => data.value)
const themeKey = computed<Theme>(() => {
  const t = profile.value?.profile.theme
  if (t === 'midnight' || t === 'rose' || t === 'forest')
    return t
  return 'default'
})
const theme = computed(() => THEMES[themeKey.value])

useSeoMeta({
  title: () => profile.value?.user.name ?? username,
  description: () => profile.value?.profile.bio ?? '',
})

const SOCIAL_ICONS: Record<string, string> = {
  instagram: 'i-simple-icons-instagram',
  x: 'i-simple-icons-x',
  tiktok: 'i-simple-icons-tiktok',
  youtube: 'i-simple-icons-youtube',
  linkedin: 'i-simple-icons-linkedin',
  github: 'i-simple-icons-github',
  website: 'i-lucide-globe',
}

onMounted(() => {
  $fetch(`/api/public/${username}/visit`, { method: 'POST' }).catch(() => {})
})
</script>

<template>
  <div
    v-if="profile"
    class="min-h-screen"
    :class="theme.bg"
  >
    <div class="max-w-lg mx-auto px-4 py-12 space-y-6">
      <!-- Avatar + name -->
      <div class="flex flex-col items-center gap-3 text-center">
        <img
          v-if="profile.profile.effectiveAvatarUrl"
          :src="profile.profile.effectiveAvatarUrl"
          :alt="profile.user.name ?? username"
          class="w-24 h-24 rounded-full object-cover border-4 border-white shadow"
        >
        <UAvatar
          v-else
          :alt="profile.user.name ?? username"
          size="3xl"
        />
        <h1
          class="text-2xl font-bold"
          :class="theme.text"
        >
          {{ profile.user.name ?? username }}
        </h1>
        <p
          v-if="profile.profile.bio"
          class="text-sm max-w-xs"
          :class="theme.text"
        >
          {{ profile.profile.bio }}
        </p>
      </div>

      <!-- Social icons -->
      <div
        v-if="profile.profile.socials && profile.profile.socials.length > 0"
        class="flex justify-center gap-4 flex-wrap"
      >
        <a
          v-for="social in profile.profile.socials"
          :key="social.platform"
          :href="social.url"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-opacity hover:opacity-75"
          :class="theme.text"
          :aria-label="social.platform"
        >
          <UIcon
            :name="SOCIAL_ICONS[social.platform] ?? 'i-lucide-link'"
            class="size-6"
          />
        </a>
      </div>

      <!-- Link buttons -->
      <div class="space-y-3">
        <a
          v-for="link in profile.links"
          :key="link.id"
          :href="link.destinationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full text-center py-3 px-6 rounded-xl font-semibold transition-colors"
          :class="[theme.cardBg, theme.button]"
        >
          {{ link.title }}
        </a>
      </div>

      <!-- Empty state -->
      <div
        v-if="profile.links.length === 0"
        class="text-center py-8 opacity-60"
        :class="theme.text"
      >
        <p class="text-sm">
          No links yet.
        </p>
      </div>
    </div>
  </div>
</template>
