<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeVariant } from '@/components/ui/types'
import type { GrantStatus } from '@/types/access-control'
import { isExpiringSoon, windowStatus, type AccessWindow } from '@/domain/grants'

/** Status of a group membership or a legacy grant. */
const { access } = defineProps<{ access: AccessWindow }>()

const LABELS: Record<GrantStatus, [string, BadgeVariant]> = {
  active: ['Active', 'success'],
  scheduled: ['Scheduled', 'neutral'],
  expired: ['Expired', 'muted'],
  revoked: ['Removed', 'danger'],
}

const display = computed(() => {
  if (isExpiringSoon(access)) return { label: 'Expiring soon', variant: 'warning' as const }
  const [label, variant] = LABELS[windowStatus(access)]
  return { label, variant }
})
</script>

<template>
  <BaseBadge :variant="display.variant" dot>{{ display.label }}</BaseBadge>
</template>
