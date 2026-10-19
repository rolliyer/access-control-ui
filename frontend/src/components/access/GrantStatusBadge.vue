<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import type { BadgeVariant } from '@/components/ui/types'
import type { GrantStatus, UserRole } from '@/types/access-control'
import { grantStatus, isExpiringSoon } from '@/domain/grants'

const { grant } = defineProps<{ grant: UserRole }>()

const LABELS: Record<GrantStatus, [string, BadgeVariant]> = {
  active: ['Active', 'success'],
  scheduled: ['Scheduled', 'neutral'],
  expired: ['Expired', 'muted'],
  revoked: ['Revoked', 'danger'],
}

const display = computed(() => {
  if (isExpiringSoon(grant)) return { label: 'Expiring soon', variant: 'warning' as const }
  const [label, variant] = LABELS[grantStatus(grant)]
  return { label, variant }
})
</script>

<template>
  <BaseBadge :variant="display.variant" dot>{{ display.label }}</BaseBadge>
</template>
