<script setup lang="ts">
import { computed } from 'vue'
import type { Domain, PermissionRef } from '@/types/access-control'
import { TIERS, domainToResource, resourceId, type ResourceDefinition } from '@/domain/resources'
import { exploratoryWarning, unknownDomainKeys } from '@/domain/validation'

const model = defineModel<PermissionRef[]>({ required: true })

/** Domains from the metrics catalogue. */
const { domains } = defineProps<{ domains: readonly Domain[] }>()

const selected = computed(() => new Set(model.value.map(resourceId)))
const warning = computed(() => exploratoryWarning(model.value, domains))
const unknownKeys = computed(() => unknownDomainKeys(model.value, domains))

function removeUnknown(key: string): void {
  model.value = model.value.filter((p) => !(p.resourceType === 'domain' && p.resourceKey === key))
}

function isChecked(resource: ResourceDefinition): boolean {
  return selected.value.has(`${resource.type}:${resource.key}`)
}

function toggle(resource: ResourceDefinition, checked: boolean): void {
  const id = `${resource.type}:${resource.key}`
  model.value = checked
    ? [...model.value, { resourceType: resource.type, resourceKey: resource.key }]
    : model.value.filter((p) => resourceId(p) !== id)
}

const groups = computed(() => [
  {
    title: 'Domains',
    hint: 'Folders of metrics this role can see.',
    items: domains.map(domainToResource),
  },
  { title: 'Special tiers', hint: 'Grant rarely.', items: TIERS },
])
</script>

<template>
  <div class="picker">
    <fieldset v-for="group in groups" :key="group.title" class="picker__group">
      <legend class="picker__legend">
        {{ group.title }} <span class="text-muted">· {{ group.hint }}</span>
      </legend>
      <label
        v-for="resource in group.items"
        :key="resource.key"
        class="picker__option"
        :class="{ 'is-checked': isChecked(resource) }"
      >
        <input
          type="checkbox"
          :checked="isChecked(resource)"
          @change="toggle(resource, ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>{{ resource.label }}</strong>
          <code class="picker__key">{{ resource.key }}</code>
          <small class="picker__description">{{ resource.description }}</small>
        </span>
      </label>
    </fieldset>
    <div v-if="unknownKeys.length" class="picker__warning" role="alert">
      <p>
        ⚠ This role has permission rows for domains that aren't in the metrics catalogue. They grant
        nothing — remove them, or check the folder name.
      </p>
      <ul class="picker__unknown">
        <li v-for="key in unknownKeys" :key="key">
          <code>{{ key }}</code>
          <button type="button" class="picker__remove" @click="removeUnknown(key)">Remove</button>
        </li>
      </ul>
    </div>
    <p v-if="warning" class="picker__warning" role="alert">⚠ {{ warning }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.picker__group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: none;
}

.picker__legend {
  margin-bottom: var(--space-2);
  padding: 0;
  font-weight: 700;
}

.picker__option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color var(--transition),
    background var(--transition);
}

.picker__option:hover {
  border-color: var(--color-accent);
}

.picker__option.is-checked {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

.picker__option input {
  margin-top: 3px;
  accent-color: var(--color-accent);
}

.picker__key {
  margin-left: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.picker__description {
  display: block;
  color: var(--color-text-muted);
}

.picker__warning {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
}

.picker__unknown {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.picker__unknown li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.picker__remove {
  border: none;
  background: none;
  color: var(--color-danger);
  font-weight: 700;
  cursor: pointer;
}
</style>
