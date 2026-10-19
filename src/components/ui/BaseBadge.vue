<script setup lang="ts">
import type { BadgeVariant } from './types'

const { variant = 'neutral', dot = false } = defineProps<{
  variant?: BadgeVariant
  dot?: boolean
}>()
</script>

<template>
  <span class="badge" :class="`badge--${variant}`">
    <span v-if="dot" class="badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
  color: var(--color-text);
}

.badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentcolor;
}

.badge--neutral {
  background: var(--color-accent-subtle);
}

.badge--accent {
  background: var(--color-accent-strong);
  color: var(--color-text-inverse);
}

.badge--muted {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-muted);
}

.badge--success {
  background: var(--color-success-bg);
}

.badge--success .badge__dot {
  color: var(--color-success);
}

.badge--warning {
  background: var(--color-warning-bg);
}

.badge--warning .badge__dot {
  color: var(--color-warning);
}

.badge--danger {
  background: var(--color-danger-bg);
}

.badge--danger .badge__dot {
  color: var(--color-danger-mark);
}
</style>
