<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const sessionState = authClient.useSession()
const toast = useToast()
const { showUpgradePrompt } = useUpgradePrompt()

interface BillingData {
  plan: 'free' | 'pro'
  usage: { links: number, automations: number, dmsToday: number }
}

const { data: billingData } = await useFetch<BillingData>('/api/user/billing')

const linkUsagePercent = computed(() => {
  const used = billingData.value?.usage.links ?? 0
  const limit = billingData.value?.plan === 'pro' ? 1000 : 10
  return Math.min(100, Math.round((used / limit) * 100))
})

const showUsageWarning = computed(() => linkUsagePercent.value >= 80)
const isDismissed = ref(false)

function isLimitReachedError(err: unknown): boolean {
  if (err !== null && typeof err === 'object'
    && 'data' in err && err.data !== null && typeof err.data === 'object'
    && 'data' in err.data && err.data.data !== null && typeof err.data.data === 'object'
    && 'code' in err.data.data) {
    return err.data.data.code === 'LIMIT_REACHED'
  }
  return false
}

// Types
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

interface StatsData {
  total: number
  referrers: { value: string | null, count: number }[]
  devices: { value: string | null, count: number }[]
  countries: { value: string | null, count: number }[]
}

// Fetch links
const { data: linksData, refresh: refreshLinks } = await useFetch<LinkRow[]>('/api/links')
const links = computed(() => linksData.value ?? [])

const username = computed(() => sessionState.value?.data?.user?.username ?? '')

function shortUrl(slug: string) {
  return `su1.ca/${username.value}/${slug}`
}

// Copy to clipboard
async function copyToClipboard(slug: string) {
  await navigator.clipboard.writeText(`https://${shortUrl(slug)}`)
  toast.add({ title: 'Copied!', color: 'success' })
}

// Create / Edit modal
const isFormModalOpen = ref(false)
const editingLink = ref<LinkRow | null>(null)
const formTitle = ref('')
const formUrl = ref('')
const formSlug = ref('')
const formShowOnPage = ref(false)
const isSubmitting = ref(false)

const formModalTitle = computed(() => editingLink.value ? 'Edit link' : 'New link')
const slugPreview = computed(() => {
  const s = formSlug.value.trim() || '(auto)'
  return `su1.ca/${username.value}/${s}`
})

function openCreateModal() {
  editingLink.value = null
  formTitle.value = ''
  formUrl.value = ''
  formSlug.value = ''
  formShowOnPage.value = false
  isFormModalOpen.value = true
}

function openEditModal(link: LinkRow) {
  editingLink.value = link
  formTitle.value = link.title
  formUrl.value = link.destinationUrl
  formSlug.value = link.slug
  formShowOnPage.value = link.showOnPage
  isFormModalOpen.value = true
}

async function submitForm() {
  isSubmitting.value = true
  try {
    const body: Record<string, unknown> = {
      title: formTitle.value.trim(),
      destinationUrl: formUrl.value.trim(),
      showOnPage: formShowOnPage.value,
    }
    if (formSlug.value.trim()) {
      body.slug = formSlug.value.trim()
    }

    if (editingLink.value) {
      await $fetch(`/api/links/${editingLink.value.id}`, { method: 'PATCH', body })
      toast.add({ title: 'Link updated', color: 'success' })
    }
    else {
      await $fetch('/api/links', { method: 'POST', body })
      toast.add({ title: 'Link created', color: 'success' })
    }

    isFormModalOpen.value = false
    await refreshLinks()
  }
  catch (err: unknown) {
    if (isLimitReachedError(err)) {
      isFormModalOpen.value = false
      showUpgradePrompt('You\'ve reached the link limit on the Free plan. Upgrade to Pro for up to 1,000 links.')
      return
    }
    const message = err instanceof Error ? err.message : 'Something went wrong'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}

// Toggle showOnPage (optimistic)
async function toggleShowOnPage(link: LinkRow) {
  const newValue = !link.showOnPage
  link.showOnPage = newValue
  try {
    await $fetch(`/api/links/${link.id}`, { method: 'PATCH', body: { showOnPage: newValue } })
  }
  catch {
    link.showOnPage = !newValue
    toast.add({ title: 'Error', description: 'Failed to update', color: 'error' })
  }
}

// Toggle isActive (optimistic)
async function toggleIsActive(link: LinkRow) {
  const newValue = !link.isActive
  link.isActive = newValue
  try {
    await $fetch(`/api/links/${link.id}`, { method: 'PATCH', body: { isActive: newValue } })
  }
  catch {
    link.isActive = !newValue
    toast.add({ title: 'Error', description: 'Failed to update', color: 'error' })
  }
}

// Delete
const isDeleteModalOpen = ref(false)
const deletingLink = ref<LinkRow | null>(null)
const isDeleting = ref(false)

function confirmDelete(link: LinkRow) {
  deletingLink.value = link
  isDeleteModalOpen.value = true
}

async function deleteLink() {
  if (!deletingLink.value)
    return
  isDeleting.value = true
  try {
    await $fetch(`/api/links/${deletingLink.value.id}`, { method: 'DELETE' })
    isDeleteModalOpen.value = false
    toast.add({ title: 'Link deleted', color: 'success' })
    await refreshLinks()
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to delete link', color: 'error' })
  }
  finally {
    isDeleting.value = false
    deletingLink.value = null
  }
}

// Stats modal
const isStatsModalOpen = ref(false)
const statsLink = ref<LinkRow | null>(null)
const statsData = ref<StatsData | null>(null)
const isLoadingStats = ref(false)

async function openStatsModal(link: LinkRow) {
  statsLink.value = link
  isStatsModalOpen.value = true
  isLoadingStats.value = true
  statsData.value = null
  try {
    statsData.value = await $fetch<StatsData>(`/api/links/${link.id}/stats`)
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to load stats', color: 'error' })
  }
  finally {
    isLoadingStats.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <!-- Usage warning banner -->
    <UAlert
      v-if="showUsageWarning && !isDismissed"
      :color="linkUsagePercent >= 100 ? 'error' : 'warning'"
      :title="linkUsagePercent >= 100 ? 'Link limit reached' : 'Approaching link limit'"
      :description="linkUsagePercent >= 100
        ? 'You\'ve reached the maximum number of links on the Free plan. Upgrade to Pro to add more.'
        : 'You\'re using 80%+ of your link allowance. Upgrade to Pro for up to 1,000 links.'"
      close-button
      @close="isDismissed = true"
    >
      <template #actions>
        <UButton
          size="sm"
          to="/app/settings/billing"
          color="primary"
        >
          Upgrade to Pro
        </UButton>
      </template>
    </UAlert>

    <!-- Top bar -->
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">
        My Links
      </h1>
      <UButton
        icon="i-lucide-plus"
        @click="openCreateModal"
      >
        New link
      </UButton>
    </div>

    <!-- Empty state -->
    <div
      v-if="links.length === 0"
      class="flex flex-col items-center justify-center py-24 gap-4 text-center"
    >
      <UIcon
        name="i-lucide-link"
        class="text-muted size-12"
      />
      <p class="text-lg font-medium">
        No links yet
      </p>
      <p class="text-sm text-muted">
        Create your first short link and start tracking clicks.
      </p>
      <UButton @click="openCreateModal">
        Create your first link
      </UButton>
    </div>

    <!-- Links list -->
    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="link in links"
        :key="link.id"
        class="overflow-hidden"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <!-- Info -->
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold truncate">{{ link.title }}</span>
              <UBadge
                v-if="!link.isActive"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                Inactive
              </UBadge>
            </div>

            <!-- Short URL with copy button -->
            <div class="flex items-center gap-1">
              <span class="text-sm text-primary font-mono truncate">{{ shortUrl(link.slug) }}</span>
              <UButton
                icon="i-lucide-copy"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Copy short URL"
                @click="copyToClipboard(link.slug)"
              />
            </div>

            <!-- Destination URL -->
            <UTooltip :text="link.destinationUrl">
              <span class="text-xs text-muted truncate block max-w-xs sm:max-w-sm">
                {{ link.destinationUrl }}
              </span>
            </UTooltip>
          </div>

          <!-- Stats + toggles + actions -->
          <div class="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <!-- Click count -->
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-bar-chart-2"
              @click="openStatsModal(link)"
            >
              {{ link.clickCount }} clicks
            </UButton>

            <!-- Show on page toggle -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted whitespace-nowrap">On page</span>
              <USwitch
                :model-value="link.showOnPage"
                size="sm"
                @update:model-value="toggleShowOnPage(link)"
              />
            </div>

            <!-- Active toggle -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted">Active</span>
              <USwitch
                :model-value="link.isActive"
                size="sm"
                @update:model-value="toggleIsActive(link)"
              />
            </div>

            <!-- Edit button -->
            <UButton
              icon="i-lucide-pencil"
              size="sm"
              color="neutral"
              variant="ghost"
              aria-label="Edit link"
              @click="openEditModal(link)"
            />

            <!-- Delete button -->
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="ghost"
              aria-label="Delete link"
              @click="confirmDelete(link)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Create / Edit modal -->
    <UModal
      v-model:open="isFormModalOpen"
      :title="formModalTitle"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Title"
            required
          >
            <UInput
              v-model="formTitle"
              placeholder="My awesome link"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Destination URL"
            required
          >
            <UInput
              v-model="formUrl"
              placeholder="https://example.com"
              type="url"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Custom slug (optional)">
            <UInput
              v-model="formSlug"
              placeholder="my-link"
              class="w-full"
            />
            <template #description>
              <span class="text-xs text-muted">
                Preview: <span class="font-mono text-primary">{{ slugPreview }}</span>
              </span>
            </template>
          </UFormField>

          <UFormField label="Show on personal page">
            <USwitch v-model="formShowOnPage" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            @click="isFormModalOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            :loading="isSubmitting"
            @click="submitForm"
          >
            {{ editingLink ? 'Save changes' : 'Create link' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal
      v-model:open="isDeleteModalOpen"
      title="Delete link"
    >
      <template #body>
        <p>
          Are you sure you want to delete
          <strong>{{ deletingLink?.title }}</strong>?
          This action cannot be undone.
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            @click="isDeleteModalOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="isDeleting"
            @click="deleteLink"
          >
            Delete
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Stats modal -->
    <UModal
      v-model:open="isStatsModalOpen"
      :title="`Stats: ${statsLink?.title}`"
    >
      <template #body>
        <div
          v-if="isLoadingStats"
          class="flex justify-center py-8"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="animate-spin size-6 text-muted"
          />
        </div>

        <div
          v-else-if="statsData"
          class="space-y-6"
        >
          <!-- Total clicks -->
          <div class="text-center">
            <p class="text-4xl font-bold text-primary">
              {{ statsData.total }}
            </p>
            <p class="text-sm text-muted mt-1">
              Total clicks
            </p>
          </div>

          <!-- Referrers -->
          <div
            v-if="statsData.referrers.length > 0"
            class="space-y-2"
          >
            <h3 class="font-semibold text-sm">
              Top Referrers
            </h3>
            <div
              v-for="r in statsData.referrers"
              :key="r.value ?? 'direct'"
              class="flex justify-between text-sm"
            >
              <span class="text-muted truncate">{{ r.value ?? 'Direct' }}</span>
              <span class="font-medium ml-2">{{ r.count }}</span>
            </div>
          </div>

          <!-- Devices -->
          <div
            v-if="statsData.devices.length > 0"
            class="space-y-2"
          >
            <h3 class="font-semibold text-sm">
              Devices
            </h3>
            <div
              v-for="d in statsData.devices"
              :key="d.value ?? 'unknown'"
              class="flex justify-between text-sm"
            >
              <span class="text-muted truncate">{{ d.value ?? 'Unknown' }}</span>
              <span class="font-medium ml-2">{{ d.count }}</span>
            </div>
          </div>

          <!-- Countries -->
          <div
            v-if="statsData.countries.length > 0"
            class="space-y-2"
          >
            <h3 class="font-semibold text-sm">
              Top Countries
            </h3>
            <div
              v-for="c in statsData.countries"
              :key="c.value ?? 'unknown'"
              class="flex justify-between text-sm"
            >
              <span class="text-muted truncate">{{ c.value ?? 'Unknown' }}</span>
              <span class="font-medium ml-2">{{ c.count }}</span>
            </div>
          </div>

          <p
            v-if="statsData.referrers.length === 0 && statsData.devices.length === 0 && statsData.countries.length === 0"
            class="text-sm text-muted text-center"
          >
            No detailed stats yet.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            @click="isStatsModalOpen = false"
          >
            Close
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
