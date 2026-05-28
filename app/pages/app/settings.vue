<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const sessionState = authClient.useSession()
const toast = useToast()

const displayName = ref(sessionState.value.data?.user?.name ?? '')
const isSaving = ref(false)
const isDeleteModalOpen = ref(false)

async function saveSettings() {
  const trimmed = displayName.value.trim()
  if (!trimmed)
    return

  isSaving.value = true
  try {
    await $fetch('/api/user/settings', {
      method: 'PATCH',
      body: { name: trimmed },
    })
    toast.add({
      title: 'Settings saved',
      description: 'Your display name has been updated.',
      color: 'success',
    })
  }
  catch {
    toast.add({
      title: 'Error',
      description: 'Failed to save settings. Please try again.',
      color: 'error',
    })
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-2xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold">
      Account Settings
    </h1>

    <!-- Profile section -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Profile
        </h2>
      </template>

      <div class="space-y-6">
        <div class="flex justify-center">
          <UAvatar
            :src="sessionState.data?.user?.image ?? undefined"
            :alt="sessionState.data?.user?.name ?? 'User'"
            size="3xl"
          />
        </div>

        <UFormField label="Display name">
          <UInput
            v-model="displayName"
            placeholder="Your name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Email">
          <UInput
            :model-value="sessionState.data?.user?.email ?? ''"
            disabled
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="isSaving"
            @click="saveSettings"
          >
            Save changes
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Danger zone -->
    <UCard class="border border-error-200 dark:border-error-800">
      <template #header>
        <h2 class="text-lg font-semibold text-error">
          Danger Zone
        </h2>
      </template>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="font-medium">
            Delete account
          </p>
          <p class="text-sm text-muted">
            Permanently delete your account and all your data.
          </p>
        </div>
        <UButton
          color="error"
          variant="outline"
          @click="isDeleteModalOpen = true"
        >
          Delete account
        </UButton>
      </div>
    </UCard>

    <!-- Delete account confirmation modal -->
    <UModal v-model:open="isDeleteModalOpen" title="Delete account">
      <template #body>
        <div class="space-y-4">
          <p>Are you sure you want to delete your account? This action cannot be undone.</p>
          <p class="text-sm text-muted">
            All your data, links, and automations will be permanently removed.
          </p>
        </div>
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
            @click="isDeleteModalOpen = false"
          >
            Delete account
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
