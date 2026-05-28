<script setup lang="ts">
import type { Theme } from '~/utils/themes'
import { THEMES } from '~/utils/themes'

definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const sessionState = authClient.useSession()
const toast = useToast()

// Types
interface Social {
  platform: string
  url: string
}

interface LinkRow {
  id: string
  title: string
  destinationUrl: string
  slug: string
  showOnPage: boolean
  isActive: boolean
  createdAt: string
  clickCount: number
}

interface PageProfile {
  bio: string | null
  theme: string | null
  socials: Social[] | null
  customAvatarUrl: string | null
  effectiveAvatarUrl: string | null
}

interface StatsData {
  total: number
  referrers: { value: string | null, count: number }[]
  devices: { value: string | null, count: number }[]
  countries: { value: string | null, count: number }[]
}

interface PublicProfile {
  user: { name: string | null, username: string | null, avatarUrl: string | null }
  profile: PageProfile
  links: { id: string, title: string, destinationUrl: string, slug: string, showOnPage: boolean, isActive: boolean, createdAt: string }[]
}

const username = computed(() => sessionState.value.data?.user?.username ?? '')

// Fetch page profile
const { data: profileData, refresh: refreshProfile } = await useFetch<PublicProfile>(
  () => username.value ? `/api/public/${username.value}` : '/api/public/_',
)

// Fetch links
const { data: linksData, refresh: refreshLinks } = await useFetch<LinkRow[]>('/api/links')

// Fetch stats
const { data: statsData } = await useFetch<StatsData>('/api/user/page/stats')

// Editor state
const bio = ref(profileData.value?.profile.bio ?? '')
function toTheme(t: string | null | undefined): Theme {
  if (t === 'midnight' || t === 'rose' || t === 'forest')
    return t
  return 'default'
}
const selectedTheme = ref<Theme>(toTheme(profileData.value?.profile.theme))
const socials = ref<Social[]>(profileData.value?.profile.socials ?? [])
const customAvatarUrl = ref<string | null>(profileData.value?.profile.customAvatarUrl ?? null)
const displayName = ref(profileData.value?.user.name ?? sessionState.value.data?.user?.name ?? '')

const isSaving = ref(false)
const isUploadingAvatar = ref(false)

const links = computed(() => linksData.value ?? [])
const stats = computed(() => statsData.value)

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'website', label: 'Website' },
]

const themeOptions: { key: Theme, label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'midnight', label: 'Midnight' },
  { key: 'rose', label: 'Rose' },
  { key: 'forest', label: 'Forest' },
]

const MAX_BIO = 160
const bioLength = computed(() => bio.value.length)

// Effective avatar for preview
const effectiveAvatar = computed(() =>
  customAvatarUrl.value ?? profileData.value?.user.avatarUrl ?? sessionState.value.data?.user?.image ?? null,
)

// Preview links for the right panel
const previewLinks = computed(() =>
  links.value.filter(l => l.showOnPage && l.isActive),
)

const previewTheme = computed(() => THEMES[selectedTheme.value])

function addSocial() {
  if (socials.value.length >= 7)
    return
  socials.value.push({ platform: 'website', url: '' })
}

function removeSocial(index: number) {
  socials.value.splice(index, 1)
}

async function save() {
  isSaving.value = true
  try {
    // Save display name if changed
    const currentName = sessionState.value.data?.user?.name ?? ''
    if (displayName.value.trim() && displayName.value.trim() !== currentName) {
      await $fetch('/api/user/settings', {
        method: 'PATCH',
        body: { name: displayName.value.trim() },
      })
      await sessionState.value?.refetch()
    }

    await $fetch('/api/user/page', {
      method: 'PATCH',
      body: {
        bio: bio.value.trim() || undefined,
        theme: selectedTheme.value,
        socials: socials.value.filter(s => s.url),
        customAvatarUrl: customAvatarUrl.value,
      },
    })

    await refreshProfile()
    toast.add({ title: 'Page saved', color: 'success' })
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to save page', color: 'error' })
  }
  finally {
    isSaving.value = false
  }
}

async function uploadAvatar(event: Event) {
  if (!(event.target instanceof HTMLInputElement))
    return
  const input = event.target
  const file = input.files?.[0]
  if (!file)
    return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    toast.add({ title: 'Invalid file type', description: 'Please use JPG, PNG, or WebP', color: 'error' })
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File too large', description: 'Max 5MB allowed', color: 'error' })
    return
  }

  isUploadingAvatar.value = true
  try {
    const { uploadURL, imageId, imageDeliveryHash } = await $fetch<{ uploadURL: string, imageId: string, imageDeliveryHash: string }>('/api/user/avatar-upload-url', {
      method: 'POST',
    })

    const formData = new FormData()
    formData.append('file', file)

    await fetch(uploadURL, { method: 'POST', body: formData })

    customAvatarUrl.value = `https://imagedelivery.net/${imageDeliveryHash}/${imageId}/public`

    toast.add({ title: 'Avatar uploaded', color: 'success' })
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to upload avatar', color: 'error' })
  }
  finally {
    isUploadingAvatar.value = false
    input.value = ''
  }
}

function useAccountAvatar() {
  customAvatarUrl.value = null
}

async function toggleLinkOnPage(link: LinkRow) {
  const newValue = !link.showOnPage
  link.showOnPage = newValue
  try {
    await $fetch(`/api/links/${link.id}`, { method: 'PATCH', body: { showOnPage: newValue } })
    await refreshLinks()
  }
  catch {
    link.showOnPage = !newValue
    toast.add({ title: 'Error', description: 'Failed to update link', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-2xl font-bold">
        My Page
      </h1>
      <div class="flex items-center gap-3">
        <UButton
          v-if="username"
          :to="`/${username}`"
          target="_blank"
          color="neutral"
          variant="outline"
          icon="i-lucide-external-link"
          size="sm"
        >
          View page
        </UButton>
        <UButton
          :loading="isSaving"
          icon="i-lucide-save"
          @click="save"
        >
          Save
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Left: Editor -->
      <div class="space-y-6">
        <!-- Avatar -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Avatar
            </h2>
          </template>
          <div class="flex flex-col items-center gap-4">
            <img
              v-if="effectiveAvatar"
              :src="effectiveAvatar"
              alt="Avatar"
              class="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow"
            >
            <UAvatar
              v-else
              :alt="displayName"
              size="3xl"
            />
            <div class="flex gap-2 flex-wrap justify-center">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-user"
                :disabled="isUploadingAvatar"
                @click="useAccountAvatar"
              >
                Use account avatar
              </UButton>
              <label class="cursor-pointer">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-upload"
                  :loading="isUploadingAvatar"
                  as="span"
                >
                  Upload image
                </UButton>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  @change="uploadAvatar"
                >
              </label>
            </div>
          </div>
        </UCard>

        <!-- Profile -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Profile
            </h2>
          </template>
          <div class="space-y-4">
            <UFormField label="Display name">
              <UInput
                v-model="displayName"
                placeholder="Your name"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Bio">
              <UTextarea
                v-model="bio"
                placeholder="Tell visitors a little about yourself..."
                class="w-full"
                :rows="3"
                :maxlength="MAX_BIO"
              />
              <template #description>
                <span
                  class="text-xs"
                  :class="bioLength >= MAX_BIO ? 'text-error' : 'text-muted'"
                >
                  {{ bioLength }}/{{ MAX_BIO }}
                </span>
              </template>
            </UFormField>
          </div>
        </UCard>

        <!-- Socials -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">
                Social links
              </h2>
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                :disabled="socials.length >= 7"
                @click="addSocial"
              >
                Add
              </UButton>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-if="socials.length === 0"
              class="text-sm text-muted text-center py-4"
            >
              No social links yet. Click Add to get started.
            </div>
            <div
              v-for="(social, i) in socials"
              :key="i"
              class="flex gap-2 items-center"
            >
              <USelect
                v-model="social.platform"
                :options="SOCIAL_PLATFORMS"
                value-key="value"
                label-key="label"
                class="w-36 shrink-0"
              />
              <UInput
                v-model="social.url"
                placeholder="https://..."
                class="flex-1 min-w-0"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                color="error"
                variant="ghost"
                aria-label="Remove social"
                @click="removeSocial(i)"
              />
            </div>
          </div>
        </UCard>

        <!-- Theme picker -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Theme
            </h2>
          </template>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              v-for="t in themeOptions"
              :key="t.key"
              class="rounded-xl border-2 p-3 text-center transition-all"
              :class="[
                THEMES[t.key].bg,
                selectedTheme === t.key ? 'border-primary ring-2 ring-primary' : 'border-transparent hover:border-gray-300',
              ]"
              @click="selectedTheme = t.key"
            >
              <div
                class="w-full h-6 rounded mb-2"
                :class="THEMES[t.key].cardBg"
              />
              <span
                class="text-xs font-medium"
                :class="THEMES[t.key].text"
              >
                {{ t.label }}
              </span>
            </button>
          </div>
        </UCard>

        <!-- Links on page -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">
                Links on page
              </h2>
              <UButton
                to="/app/links"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
              >
                Manage links
              </UButton>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-if="links.length === 0"
              class="text-sm text-muted text-center py-4"
            >
              No links yet.
              <NuxtLink
                to="/app/links"
                class="text-primary underline"
              >
                Add some
              </NuxtLink>
            </div>
            <div
              v-for="link in links"
              :key="link.id"
              class="flex items-center gap-3"
            >
              <USwitch
                :model-value="link.showOnPage"
                size="sm"
                @update:model-value="toggleLinkOnPage(link)"
              />
              <span class="text-sm truncate flex-1">{{ link.title }}</span>
              <UBadge
                v-if="!link.isActive"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                Inactive
              </UBadge>
            </div>
          </div>
        </UCard>

        <!-- Stats -->
        <UCard v-if="stats">
          <template #header>
            <h2 class="font-semibold">
              Page stats
            </h2>
          </template>
          <div class="space-y-4">
            <div class="text-center">
              <p class="text-4xl font-bold text-primary">
                {{ stats.total }}
              </p>
              <p class="text-sm text-muted">
                Total visits
              </p>
            </div>

            <div
              v-if="stats.referrers.length > 0"
              class="space-y-1"
            >
              <p class="text-xs font-semibold uppercase text-muted tracking-wider">
                Top Referrers
              </p>
              <div
                v-for="r in stats.referrers"
                :key="r.value ?? 'direct'"
                class="flex justify-between text-sm"
              >
                <span class="text-muted truncate">{{ r.value ?? 'Direct' }}</span>
                <span class="font-medium">{{ r.count }}</span>
              </div>
            </div>

            <div
              v-if="stats.devices.length > 0"
              class="space-y-1"
            >
              <p class="text-xs font-semibold uppercase text-muted tracking-wider">
                Devices
              </p>
              <div
                v-for="d in stats.devices"
                :key="d.value ?? 'unknown'"
                class="flex justify-between text-sm"
              >
                <span class="text-muted truncate capitalize">{{ d.value ?? 'Unknown' }}</span>
                <span class="font-medium">{{ d.count }}</span>
              </div>
            </div>

            <div
              v-if="stats.countries.length > 0"
              class="space-y-1"
            >
              <p class="text-xs font-semibold uppercase text-muted tracking-wider">
                Top Countries
              </p>
              <div
                v-for="c in stats.countries"
                :key="c.value ?? 'unknown'"
                class="flex justify-between text-sm"
              >
                <span class="text-muted truncate">{{ c.value ?? 'Unknown' }}</span>
                <span class="font-medium">{{ c.count }}</span>
              </div>
            </div>

            <p
              v-if="stats.total === 0"
              class="text-sm text-muted text-center"
            >
              No visits yet.
            </p>
          </div>
        </UCard>
      </div>

      <!-- Right: Live preview (desktop only) -->
      <div class="hidden lg:block">
        <div class="sticky top-6">
          <p class="text-xs font-semibold uppercase text-muted tracking-wider mb-3">
            Live preview
          </p>
          <div
            class="rounded-2xl overflow-hidden shadow-lg min-h-[500px]"
            :class="previewTheme.bg"
          >
            <div class="max-w-sm mx-auto px-4 py-10 space-y-5">
              <!-- Avatar + name -->
              <div class="flex flex-col items-center gap-2 text-center">
                <img
                  v-if="effectiveAvatar"
                  :src="effectiveAvatar"
                  alt="Avatar"
                  class="w-20 h-20 rounded-full object-cover border-4 border-white shadow"
                >
                <UAvatar
                  v-else
                  :alt="displayName"
                  size="2xl"
                />
                <h2
                  class="text-xl font-bold"
                  :class="previewTheme.text"
                >
                  {{ displayName || 'Your Name' }}
                </h2>
                <p
                  v-if="bio"
                  class="text-xs max-w-xs"
                  :class="previewTheme.text"
                >
                  {{ bio }}
                </p>
              </div>

              <!-- Social icons -->
              <div
                v-if="socials.length > 0"
                class="flex justify-center gap-3 flex-wrap"
              >
                <span
                  v-for="(social, i) in socials"
                  :key="i"
                  class="text-xs px-2 py-1 rounded"
                  :class="[previewTheme.cardBg, previewTheme.text]"
                >
                  {{ social.platform }}
                </span>
              </div>

              <!-- Link buttons -->
              <div class="space-y-2">
                <div
                  v-for="link in previewLinks"
                  :key="link.id"
                  class="w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold"
                  :class="[previewTheme.cardBg, previewTheme.button]"
                >
                  {{ link.title }}
                </div>
                <div
                  v-if="previewLinks.length === 0"
                  class="text-center py-4 text-xs opacity-50"
                  :class="previewTheme.text"
                >
                  Enable links above to see them here
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
