<script setup lang="ts">
const { padded = true } = defineProps<{
  title?: string
  subtitle?: string
  padded?: boolean
}>()
</script>

<template>
  <section class="card">
    <header v-if="title || $slots.actions" class="card__header">
      <div>
        <h2 v-if="title" class="card__title">{{ title }}</h2>
        <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="card__actions"><slot name="actions" /></div>
    </header>
    <div :class="{ card__body: padded }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.card__title {
  font-size: var(--text-md);
}

.card__subtitle {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.card__body {
  padding: var(--space-5);
}
</style>
