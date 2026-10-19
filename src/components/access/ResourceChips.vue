<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useCatalogStore } from '@/stores/catalog'
import type { ResourceType } from '@/types/access-control'

const {
  domains = [],
  tiers = [],
  emptyLabel = 'No access',
} = defineProps<{
  domains?: readonly string[]
  tiers?: readonly string[]
  emptyLabel?: string
}>()

const catalog = useCatalogStore()

/** Catalogue order; keys missing from the catalogue are flagged (they grant nothing). */
const ordered = computed(() =>
  [
    ...domains.map((key) => ({ resourceType: 'domain' as ResourceType, resourceKey: key })),
    ...tiers.map((key) => ({ resourceType: 'tier' as ResourceType, resourceKey: key })),
  ]
    .sort((a, b) => catalog.orderOf(a) - catalog.orderOf(b))
    .map((ref) => ({
      ...ref,
      id: `${ref.resourceType}:${ref.resourceKey}`,
      label: catalog.labelFor(ref),
      known: catalog.isKnown(ref),
    })),
)

function variantFor(item: { resourceType: ResourceType; known: boolean }) {
  if (!item.known) return 'danger' as const
  return item.resourceType === 'tier' ? ('accent' as const) : ('neutral' as const)
}

function titleFor(item: { resourceType: ResourceType; resourceKey: string; known: boolean }) {
  if (!item.known) return `"${item.resourceKey}" is not in the metrics catalogue — grants nothing`
  return item.resourceType === 'tier' ? 'Special tier' : `Domain: ${item.resourceKey}`
}
</script>

<template>
  <span v-if="ordered.length" class="chips">
    <BaseBadge
      v-for="item in ordered"
      :key="item.id"
      :variant="variantFor(item)"
      :dot="!item.known"
      :title="titleFor(item)"
    >
      {{ item.label }}<template v-if="!item.known"> (unknown)</template>
    </BaseBadge>
  </span>
  <span v-else class="text-muted">{{ emptyLabel }}</span>
</template>

<style scoped>
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
</style>
