<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const toast = useToast()
const { showUpgradePrompt } = useUpgradePrompt()

interface BillingData {
  plan: 'free' | 'pro'
  usage: { links: number, automations: number, dmsToday: number }
}

const { data: billingData } = await useFetch<BillingData>('/api/user/billing')

const automationUsagePercent = computed(() => {
  const used = billingData.value?.usage.automations ?? 0
  const limit = billingData.value?.plan === 'pro' ? 20 : 1
  return Math.min(100, Math.round((used / limit) * 100))
})

const showUsageWarning = computed(() => automationUsagePercent.value >= 80)
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

interface InstagramAccount {
  id: string
  igUserId: string
  igUsername: string
  connectedAt: string
}

interface Automation {
  id: string
  userId: string
  igAccountId: string
  name: string
  postIds: string[]
  keywords: string[] | null
  message: string
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

const { data: igAccount, refresh: refreshAccount } = await useAsyncData('ig-account', () =>
  $fetch<InstagramAccount | null>('/api/user/instagram-account'))

const { data: automationsData, refresh: refreshAutomations } = await useAsyncData('automations', () =>
  $fetch<Automation[]>('/api/user/automations'))

const automationsList = computed(() => automationsData.value ?? [])

// Disconnect Instagram
const isDisconnecting = ref(false)

async function disconnectInstagram() {
  isDisconnecting.value = true
  try {
    await $fetch('/api/user/instagram-account', { method: 'DELETE' })
    toast.add({ title: 'Instagram account disconnected', color: 'success' })
    await refreshAccount()
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to disconnect', color: 'error' })
  }
  finally {
    isDisconnecting.value = false
  }
}

// Drag and drop reorder
const draggedId = ref<string | null>(null)

function onDragStart(id: string) {
  draggedId.value = id
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

async function onDrop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId) {
    draggedId.value = null
    return
  }
  const list = [...automationsList.value]
  const fromIdx = list.findIndex(a => a.id === draggedId.value)
  const toIdx = list.findIndex(a => a.id === targetId)
  if (fromIdx === -1 || toIdx === -1) {
    draggedId.value = null
    return
  }
  const [moved] = list.splice(fromIdx, 1)
  if (moved) {
    list.splice(toIdx, 0, moved)
  }
  draggedId.value = null
  try {
    await $fetch('/api/user/automations/reorder', {
      method: 'PATCH',
      body: { ids: list.map(a => a.id) },
    })
    await refreshAutomations()
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to reorder', color: 'error' })
  }
}

// Toggle active
async function toggleActive(automation: Automation) {
  const newValue = !automation.isActive
  try {
    await $fetch(`/api/user/automations/${automation.id}`, {
      method: 'PATCH',
      body: { isActive: newValue },
    })
    await refreshAutomations()
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to update', color: 'error' })
  }
}

// Delete automation
const isDeletingAutomation = ref(false)
const automationToDelete = ref<Automation | null>(null)
const isDeleteModalOpen = ref(false)

function confirmDeleteAutomation(a: Automation) {
  automationToDelete.value = a
  isDeleteModalOpen.value = true
}

async function deleteAutomation() {
  if (!automationToDelete.value)
    return
  isDeletingAutomation.value = true
  try {
    const deleteUrl: string = `/api/user/automations/${automationToDelete.value.id}`
    await $fetch(deleteUrl, { method: 'DELETE' })
    isDeleteModalOpen.value = false
    toast.add({ title: 'Automation deleted', color: 'success' })
    await refreshAutomations()
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to delete', color: 'error' })
  }
  finally {
    isDeletingAutomation.value = false
    automationToDelete.value = null
  }
}

// Automation form modal
const isFormModalOpen = ref(false)
const editingAutomation = ref<Automation | null>(null)
const isSubmitting = ref(false)

const formName = ref('')
const formPostUrls = ref('')
const formKeywords = ref('')
const formMessage = ref('')
const formIsActive = ref(true)

const USERNAME_PLACEHOLDER = '{{username}}'
const formModalTitle = computed(() => editingAutomation.value ? 'Edit automation' : 'New automation')
const messageCharCount = computed(() => formMessage.value.length)
const keywordTags = computed(() =>
  formKeywords.value.split(',').map(k => k.trim()).filter(k => k.length > 0),
)

function extractPostId(url: string): string {
  const trimmed = url.trim()
  const match = trimmed.match(/instagram\.com\/p\/([^/?#]+)/)
  if (match && match[1]) {
    return match[1]
  }
  // If it doesn't look like a URL, treat it as a raw ID
  return trimmed
}

function openCreateModal() {
  editingAutomation.value = null
  formName.value = ''
  formPostUrls.value = ''
  formKeywords.value = ''
  formMessage.value = ''
  formIsActive.value = true
  isFormModalOpen.value = true
}

function openEditModal(a: Automation) {
  editingAutomation.value = a
  formName.value = a.name
  formPostUrls.value = a.postIds.join('\n')
  formKeywords.value = (a.keywords ?? []).join(', ')
  formMessage.value = a.message
  formIsActive.value = a.isActive
  isFormModalOpen.value = true
}

function insertUsername() {
  formMessage.value += USERNAME_PLACEHOLDER
}

async function submitForm() {
  if (!igAccount.value) {
    toast.add({ title: 'Connect Instagram first', color: 'error' })
    return
  }

  const postIds = formPostUrls.value
    .split('\n')
    .map(line => extractPostId(line))
    .filter(id => id.length > 0)

  const keywords = keywordTags.value.length > 0 ? keywordTags.value : undefined

  const body = {
    name: formName.value.trim(),
    igAccountId: igAccount.value.id,
    postIds,
    keywords,
    message: formMessage.value,
    isActive: formIsActive.value,
  }

  isSubmitting.value = true
  try {
    if (editingAutomation.value) {
      await $fetch(`/api/user/automations/${editingAutomation.value.id}`, { method: 'PATCH', body })
      toast.add({ title: 'Automation updated', color: 'success' })
    }
    else {
      await $fetch('/api/user/automations', { method: 'POST', body })
      toast.add({ title: 'Automation created', color: 'success' })
    }
    isFormModalOpen.value = false
    await refreshAutomations()
  }
  catch (err: unknown) {
    if (isLimitReachedError(err)) {
      isFormModalOpen.value = false
      showUpgradePrompt('You\'ve reached the automation limit on the Free plan. Upgrade to Pro for up to 20 automations.')
      return
    }
    const message = err instanceof Error ? err.message : 'Something went wrong'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <!-- Usage warning banner -->
    <UAlert
      v-if="showUsageWarning && !isDismissed"
      :color="automationUsagePercent >= 100 ? 'error' : 'warning'"
      :title="automationUsagePercent >= 100 ? 'Automation limit reached' : 'Approaching automation limit'"
      :description="automationUsagePercent >= 100
        ? 'You\'ve reached the maximum number of automations on the Free plan. Upgrade to Pro to add more.'
        : 'You\'re using 80%+ of your automation allowance. Upgrade to Pro for up to 20 automations.'"
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
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <h1 class="text-2xl font-bold">
        Automations
      </h1>
      <UButton
        v-if="igAccount"
        icon="i-lucide-plus"
        @click="openCreateModal"
      >
        Add automation
      </UButton>
    </div>

    <!-- Instagram account card -->
    <UCard>
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <UIcon
            name="i-simple-icons-instagram"
            class="size-7 text-pink-500"
          />
          <div>
            <p class="font-semibold text-sm">
              Instagram Account
            </p>
            <div v-if="igAccount">
              <UBadge
                color="success"
                variant="subtle"
              >
                @{{ igAccount.igUsername }}
              </UBadge>
            </div>
            <p
              v-else
              class="text-sm text-muted"
            >
              No account connected
            </p>
          </div>
        </div>

        <div v-if="igAccount">
          <UButton
            color="error"
            variant="outline"
            size="sm"
            :loading="isDisconnecting"
            @click="disconnectInstagram"
          >
            Disconnect
          </UButton>
        </div>
        <div v-else>
          <UButton
            as="a"
            href="/instagram/connect"
            icon="i-lucide-link"
          >
            Connect Instagram account
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Automations list -->
    <div v-if="igAccount">
      <!-- Empty state -->
      <div
        v-if="automationsList.length === 0"
        class="flex flex-col items-center justify-center py-24 gap-4 text-center"
      >
        <UIcon
          name="i-lucide-zap"
          class="text-muted size-12"
        />
        <p class="text-lg font-medium">
          No automations yet
        </p>
        <p class="text-sm text-muted">
          Create your first automation to automatically reply to Instagram comments with a DM.
        </p>
        <UButton @click="openCreateModal">
          Create your first automation
        </UButton>
      </div>

      <!-- List -->
      <div
        v-else
        class="space-y-3"
      >
        <UCard
          v-for="automation in automationsList"
          :key="automation.id"
          draggable="true"
          class="cursor-grab active:cursor-grabbing"
          @dragstart="onDragStart(automation.id)"
          @dragover="onDragOver"
          @drop="onDrop(automation.id)"
        >
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <UIcon
              name="i-lucide-grip-vertical"
              class="text-muted size-4 hidden sm:block shrink-0"
            />

            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold truncate">{{ automation.name }}</span>
                <UBadge
                  v-if="!automation.isActive"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  Inactive
                </UBadge>
              </div>
              <div class="flex items-center gap-3 flex-wrap text-xs text-muted">
                <span>{{ automation.postIds.length }} post{{ automation.postIds.length !== 1 ? 's' : '' }}</span>
                <span v-if="automation.keywords && automation.keywords.length > 0">
                  {{ automation.keywords.length }} keyword{{ automation.keywords.length !== 1 ? 's' : '' }}
                </span>
                <span v-else>
                  Any comment
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-muted">Active</span>
                <USwitch
                  :model-value="automation.isActive"
                  size="sm"
                  @update:model-value="toggleActive(automation)"
                />
              </div>

              <UButton
                icon="i-lucide-pencil"
                size="sm"
                color="neutral"
                variant="ghost"
                aria-label="Edit automation"
                @click="openEditModal(automation)"
              />

              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                color="error"
                variant="ghost"
                aria-label="Delete automation"
                @click="confirmDeleteAutomation(automation)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Automation form modal -->
    <UModal
      v-model:open="isFormModalOpen"
      :title="formModalTitle"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="formName"
              placeholder="Reply to new comments"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Instagram post URLs (one per line)"
            required
          >
            <UTextarea
              v-model="formPostUrls"
              placeholder="https://www.instagram.com/p/ABC123/"
              class="w-full"
              :rows="3"
            />
          </UFormField>

          <UFormField label="Keywords (comma-separated, optional)">
            <UInput
              v-model="formKeywords"
              placeholder="buy, price, how much"
              class="w-full"
            />
            <template
              v-if="keywordTags.length > 0"
              #description
            >
              <div class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="tag in keywordTags"
                  :key="tag"
                  color="primary"
                  variant="subtle"
                  size="xs"
                >
                  {{ tag }}
                </UBadge>
              </div>
            </template>
          </UFormField>

          <UFormField
            label="Message"
            required
          >
            <div class="space-y-1 w-full">
              <UTextarea
                v-model="formMessage"
                placeholder="Hey {{username}}, thanks for your comment! ..."
                class="w-full"
                :rows="4"
                :maxlength="1000"
              />
              <div class="flex items-center justify-between text-xs text-muted">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="insertUsername"
                >
                  Insert {{ USERNAME_PLACEHOLDER }}
                </UButton>
                <span>{{ messageCharCount }}/1000</span>
              </div>
            </div>
          </UFormField>

          <UFormField label="Active">
            <USwitch v-model="formIsActive" />
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
            {{ editingAutomation ? 'Save changes' : 'Create automation' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal
      v-model:open="isDeleteModalOpen"
      title="Delete automation"
    >
      <template #body>
        <p>
          Are you sure you want to delete
          <strong>{{ automationToDelete?.name }}</strong>?
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
            :loading="isDeletingAutomation"
            @click="deleteAutomation"
          >
            Delete
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
