<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const {
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  to,
} = defineProps<{
  variant?: Variant
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  loading?: boolean
  disabled?: boolean
  /** Renders a RouterLink styled as a button. */
  to?: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink v-if="to" :to="to" class="btn" :class="[`btn--${variant}`, `btn--${size}`]">
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
/* Pill buttons in Roller's CTA style (see roller.software). */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition);
}

.btn:hover {
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--md {
  height: 40px;
  padding: 0 var(--space-5);
  font-size: 0.9375rem;
}

.btn--sm {
  height: 30px;
  padding: 0 var(--space-4);
  font-size: var(--text-xs);
}

.btn--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.btn--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
  color: var(--button-primary-text);
}

.btn--secondary {
  background: var(--color-surface);
  border-color: var(--button-secondary-border);
  color: var(--button-secondary-text);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--button-secondary-bg-hover);
  color: var(--button-secondary-text);
}

.btn--ghost {
  background: transparent;
  color: var(--button-secondary-text);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--button-secondary-bg-hover);
}

.btn--danger {
  background: var(--color-surface);
  border-color: var(--button-danger);
  color: var(--button-danger);
}

.btn--danger:hover:not(:disabled) {
  background: var(--button-danger-bg-hover);
}

.btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
