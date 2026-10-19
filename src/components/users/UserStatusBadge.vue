<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'

defineProps<{ active: boolean }>()
</script>

<template>
  <BaseBadge :variant="active ? 'success' : 'muted'" dot>
    {{ active ? 'Active' : 'Inactive' }}
  </BaseBadge>
</template>
