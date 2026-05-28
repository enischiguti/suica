<script setup lang="ts">
const featureGroups = [
  {
    heading: 'Personal page',
    features: [
      {
        icon: 'i-lucide-layout-list',
        title: 'Your links, your way',
        description: 'Curate everything that matters in one shareable page.',
      },
      {
        icon: 'i-lucide-link',
        title: 'Your own URL',
        description: 'Live at su1.ca/username, yours to customize.',
      },
      {
        icon: 'i-lucide-share-2',
        title: 'Share anything',
        description: 'Links, social profiles, contact info, and more.',
      },
    ],
  },
  {
    heading: 'Short links',
    features: [
      {
        icon: 'i-lucide-scissors',
        title: 'Your personal URL shortener',
        description: 'Create short links at su1.ca/username/anything in seconds.',
      },
      {
        icon: 'i-lucide-pencil',
        title: 'Edit the destination anytime',
        description: 'Change where a link points without touching the URL.',
      },
      {
        icon: 'i-lucide-bar-chart-2',
        title: 'See who\'s clicking',
        description: 'Track clicks, referrers, devices, and countries per link.',
      },
    ],
  },
  {
    heading: 'Instagram automation',
    features: [
      {
        icon: 'i-lucide-message-circle',
        title: 'Auto-reply DMs',
        description: 'Send a DM automatically when someone comments on your post.',
      },
      {
        icon: 'i-lucide-clock',
        title: 'Set it and forget it',
        description: 'Define rules once; Suica handles the rest 24/7.',
      },
      {
        icon: 'i-lucide-trending-up',
        title: 'Grow on autopilot',
        description: 'Convert comment engagement into real conversations.',
      },
    ],
  },
]

const freePlanFeatures = [
  'Personal link page at su1.ca/username',
  'Up to 10 short links',
  '1 Instagram automation',
  'Up to 100 DMs/day',
  'Basic analytics (click count and total page visits only)',
]

const proPlanFeatures = [
  'Everything in Free',
  'Up to 1,000 short links',
  'Up to 20 Instagram automations',
  'Instagram DM limit (200/hr, platform maximum)',
  'Full analytics (referrer, device, country breakdown)',
]
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero
      class="relative overflow-hidden"
    >
      <template #description>
        <p class="text-lg text-muted max-w-xl mx-auto">
          Create your personal link page and automate your Instagram DMs — all in one place. Free to start.
        </p>
        <div class="mt-6 flex flex-wrap gap-3 justify-center">
          <UButton
            to="/login"
            label="Get started free"
            size="xl"
            color="primary"
            trailing-icon="i-lucide-arrow-right"
          />
          <UButton
            to="#features"
            label="See how it works"
            size="xl"
            color="neutral"
            variant="subtle"
          />
        </div>
        <div class="mt-3">
          <UButton
            to="#pricing"
            label="See pricing"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
      </template>

      <template #title>
        <div class="flex items-center justify-center gap-3 flex-wrap">
          <span>Your internet presence,</span>
          <span class="text-primary">simplified</span>
        </div>
      </template>

      <!-- Watermelon decorative element -->
      <template #bottom>
        <div class="flex justify-center mt-8 select-none pointer-events-none" aria-hidden="true">
          <span class="text-8xl opacity-20 rotate-12">🍉</span>
        </div>
      </template>
    </UPageHero>

    <!-- Features -->
    <UPageSection
      id="features"
      title="Everything you need to grow online"
      description="From your personal link page to Instagram DM automation — Suica does it all."
    >
      <div class="space-y-12">
        <div
          v-for="group in featureGroups"
          :key="group.heading"
        >
          <h3 class="text-sm font-semibold uppercase tracking-widest text-muted mb-6 text-center">
            {{ group.heading }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <UPageCard
              v-for="feature in group.features"
              :key="feature.title"
              :icon="feature.icon"
              :title="feature.title"
              :description="feature.description"
            />
          </div>
        </div>
      </div>
    </UPageSection>

    <!-- Pricing -->
    <UPageSection
      id="pricing"
      title="Simple, transparent pricing"
      description="Start for free. Upgrade when you need more."
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Free plan -->
        <UPricingPlan
          title="Free"
          description="Get started at no cost."
          price="$0"
          billing-cycle="/mo"
          :features="freePlanFeatures"
          :button="{
            label: 'Get started free',
            to: '/login',
            color: 'neutral',
            variant: 'outline',
          }"
        />

        <!-- Pro plan -->
        <UPricingPlan
          title="Pro"
          description="For creators who want to grow faster."
          :features="proPlanFeatures"
          highlight
          badge="Most popular"
          :button="{
            label: 'Get Pro',
            to: '/login',
            color: 'primary',
          }"
        >
          <template #price>
            <div>
              <span class="text-4xl font-bold">$9</span>
              <span class="text-muted">/mo</span>
              <p class="text-sm text-muted mt-1">
                or $7/mo billed annually
              </p>
            </div>
          </template>
        </UPricingPlan>
      </div>
    </UPageSection>
  </div>
</template>
