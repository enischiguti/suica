<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'app',
})

const toast = useToast()
const route = useRoute()

interface BillingData {
  plan: 'free' | 'pro'
  usage: {
    links: number
    automations: number
    dmsToday: number
  }
  subscription?: {
    status: string
    interval: string
    renewalDate: string | null
  }
}

const { data: billing, refresh } = await useFetch<BillingData>('/api/user/billing')

const planLimits = {
  free: { links: 10, automations: 1, dmsPerDay: 100 },
  pro: { links: 1000, automations: 20, dmsPerDay: null },
}

function usagePercent(used: number, limit: number | null): number {
  if (limit === null)
    return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function progressColor(percent: number): 'primary' | 'warning' | 'error' {
  if (percent >= 100)
    return 'error'
  if (percent >= 80)
    return 'warning'
  return 'primary'
}

const isCheckingOut = ref(false)

async function startCheckout(interval: 'monthly' | 'annual') {
  isCheckingOut.value = true
  try {
    const { url } = await $fetch<{ url: string | null }>('/api/billing/checkout', {
      method: 'POST',
      body: { interval },
    })
    if (url) {
      window.location.href = url
    }
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to start checkout. Please try again.', color: 'error' })
    isCheckingOut.value = false
  }
}

const isPortalLoading = ref(false)

async function openPortal() {
  isPortalLoading.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/billing/portal', { method: 'POST' })
    window.location.href = url
  }
  catch {
    toast.add({ title: 'Error', description: 'Failed to open billing portal. Please try again.', color: 'error' })
    isPortalLoading.value = false
  }
}

onMounted(async () => {
  if (route.query.success === '1') {
    await refresh()
    toast.add({
      title: 'Subscription activated!',
      description: 'Welcome to Pro. Enjoy unlimited access.',
      color: 'success',
    })
  }
})

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr)
    return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold">
      Billing
    </h1>

    <!-- Loading state -->
    <div
      v-if="!billing"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-6 text-muted"
      />
    </div>

    <template v-else>
      <!-- Current plan -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              Current plan
            </h2>
            <UBadge
              :color="billing.plan === 'pro' ? 'primary' : 'neutral'"
              variant="subtle"
              size="lg"
            >
              {{ billing.plan === 'pro' ? 'Pro' : 'Free' }}
            </UBadge>
          </div>
        </template>

        <!-- Pro subscription details -->
        <div
          v-if="billing.plan === 'pro' && billing.subscription"
          class="space-y-4"
        >
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-muted">
                Status
              </p>
              <p class="font-medium capitalize">
                {{ billing.subscription.status }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Billing interval
              </p>
              <p class="font-medium capitalize">
                {{ billing.subscription.interval }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Next renewal
              </p>
              <p class="font-medium">
                {{ formatDate(billing.subscription.renewalDate) }}
              </p>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton
              color="neutral"
              variant="outline"
              :loading="isPortalLoading"
              icon="i-lucide-external-link"
              @click="openPortal"
            >
              Manage subscription
            </UButton>
          </div>
        </div>

        <!-- Free plan upgrade cards -->
        <div
          v-else-if="billing.plan === 'free'"
          class="space-y-4"
        >
          <p class="text-muted text-sm">
            Upgrade to Pro for unlimited links, more automations, and no daily DM cap.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Monthly -->
            <UCard class="border-2 border-neutral-200 dark:border-neutral-700 hover:border-primary transition-colors">
              <div class="space-y-3 text-center">
                <p class="font-semibold text-lg">
                  Monthly
                </p>
                <div>
                  <span class="text-3xl font-bold">$9</span>
                  <span class="text-muted text-sm">/month</span>
                </div>
                <UButton
                  class="w-full"
                  :loading="isCheckingOut"
                  @click="startCheckout('monthly')"
                >
                  Upgrade monthly
                </UButton>
              </div>
            </UCard>

            <!-- Annual -->
            <UCard class="border-2 border-primary hover:border-primary transition-colors">
              <div class="space-y-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <p class="font-semibold text-lg">
                    Annual
                  </p>
                  <UBadge
                    color="success"
                    size="xs"
                  >
                    Save 22%
                  </UBadge>
                </div>
                <div>
                  <span class="text-3xl font-bold">$7</span>
                  <span class="text-muted text-sm">/month</span>
                </div>
                <p class="text-xs text-muted">
                  Billed annually ($84/year)
                </p>
                <UButton
                  class="w-full"
                  :loading="isCheckingOut"
                  @click="startCheckout('annual')"
                >
                  Upgrade annually
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
      </UCard>

      <!-- Usage meters -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            Usage
          </h2>
        </template>

        <div class="space-y-6">
          <!-- Links -->
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="font-medium">Links</span>
              <span class="text-muted">
                {{ billing.usage.links }} / {{ planLimits[billing.plan].links }}
              </span>
            </div>
            <UProgress
              :value="usagePercent(billing.usage.links, planLimits[billing.plan].links)"
              :color="progressColor(usagePercent(billing.usage.links, planLimits[billing.plan].links))"
            />
          </div>

          <!-- Automations -->
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="font-medium">Automations</span>
              <span class="text-muted">
                {{ billing.usage.automations }} / {{ planLimits[billing.plan].automations }}
              </span>
            </div>
            <UProgress
              :value="usagePercent(billing.usage.automations, planLimits[billing.plan].automations)"
              :color="progressColor(usagePercent(billing.usage.automations, planLimits[billing.plan].automations))"
            />
          </div>

          <!-- DMs Today (Free only) -->
          <div
            v-if="billing.plan === 'free'"
            class="space-y-2"
          >
            <div class="flex justify-between text-sm">
              <span class="font-medium">DMs sent today</span>
              <span class="text-muted">
                {{ billing.usage.dmsToday }} / {{ planLimits.free.dmsPerDay }}
              </span>
            </div>
            <UProgress
              :value="usagePercent(billing.usage.dmsToday, planLimits.free.dmsPerDay)"
              :color="progressColor(usagePercent(billing.usage.dmsToday, planLimits.free.dmsPerDay))"
            />
          </div>
        </div>
      </UCard>
    </template>
  </UContainer>
</template>
