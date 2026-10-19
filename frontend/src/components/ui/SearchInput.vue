<script setup lang="ts">
import { useId } from 'vue'

const model = defineModel<string>({ default: '' })

const { label = 'Search', placeholder = 'Search…' } = defineProps<{
  label?: string
  placeholder?: string
}>()

const id = useId()
</script>

<template>
  <div class="search">
    <label class="visually-hidden" :for="id">{{ label }}</label>
    <svg class="search__icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="m13 13 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      :id="id"
      v-model="model"
      class="search__input"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
    />
    <button
      v-if="model"
      type="button"
      class="search__clear"
      aria-label="Clear search"
      @click="model = ''"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.search__icon {
  position: absolute;
  left: var(--space-3);
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search__input {
  width: 100%;
  height: 38px;
  padding: 0 var(--space-6) 0 calc(var(--space-3) + 24px);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-input-text);
  font-weight: 500;
}

.search__input:focus {
  border-color: var(--color-input-focus);
  outline: 3px solid var(--color-focus);
  outline-offset: 0;
}

.search__input::-webkit-search-cancel-button {
  display: none;
}

.search__clear {
  position: absolute;
  right: var(--space-2);
  border: none;
  background: none;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
}
</style>
