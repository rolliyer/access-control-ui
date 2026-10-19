<script setup lang="ts">
/** Label + hint + error wrapper. The control goes in the default slot and receives `id`. */
defineProps<{
  id: string
  label: string
  hint?: string
  error?: string | null
  required?: boolean
}>()
</script>

<template>
  <div class="field" :class="{ 'has-error': error }">
    <label :for="id" class="field__label">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>
    <slot :id="id" :described-by="error ? `${id}-error` : hint ? `${id}-hint` : undefined" />
    <p v-if="error" :id="`${id}-error`" class="field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field__label {
  font-weight: 600;
  color: var(--color-label);
}

.field__required {
  color: var(--color-required);
  margin-left: 2px;
}

.field__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.field__error {
  font-size: var(--text-xs);
  color: var(--color-danger);
}

.field :slotted(.control) {
  width: 100%;
  min-height: 38px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-input-text);
  font-weight: 500;
  transition: border-color var(--transition);
}

.field :slotted(.control:focus) {
  border-color: var(--color-input-focus);
  outline: 3px solid var(--color-focus);
  outline-offset: 0;
}

.field.has-error :slotted(.control) {
  border-color: var(--color-danger);
}

.field :slotted(textarea.control) {
  resize: vertical;
  min-height: 72px;
}
</style>
