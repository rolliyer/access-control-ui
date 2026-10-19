<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  label: string
  value: number | string
  caption?: string
  to?: RouteLocationRaw
}>()
</script>

<template>
  <component :is="to ? 'RouterLink' : 'div'" :to="to" class="stat" :class="{ 'is-link': to }">
    <span class="stat__label">{{ label }}</span>
    <span class="stat__value">{{ value }}</span>
    <span v-if="caption" class="stat__caption">{{ caption }}</span>
  </component>
</template>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
}

.stat.is-link:hover {
  border-color: var(--color-accent);
  text-decoration: none;
  color: var(--color-text);
}

.stat__label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.stat__value {
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.1;
}

.stat__caption {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
