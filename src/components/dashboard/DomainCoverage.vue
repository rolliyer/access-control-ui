<script setup lang="ts">
import { computed } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAccessStore } from '@/stores/access'
import { useUsersStore } from '@/stores/users'

/** How many active users can see each domain, as horizontal bars. */
const access = useAccessStore()
const usersStore = useUsersStore()
const catalog = useCatalogStore()

const rows = computed(() => {
  const total = Math.max(usersStore.activeCount, 1)
  return catalog.domainResources.map((domain) => {
    const count = access.userCountWithDomain(domain.key)
    return { ...domain, count, percent: Math.round((count / total) * 100) }
  })
})
</script>

<template>
  <ul class="coverage">
    <li v-for="row in rows" :key="row.key" class="coverage__row">
      <div class="coverage__label">
        <span>{{ row.label }}</span>
        <span class="coverage__count">
          {{ row.count }} <span class="text-muted">/ {{ usersStore.activeCount }}</span>
        </span>
      </div>
      <div
        class="coverage__track"
        role="progressbar"
        :aria-valuenow="row.count"
        aria-valuemin="0"
        :aria-valuemax="usersStore.activeCount"
        :aria-label="`${row.label}: ${row.count} users`"
      >
        <div class="coverage__bar" :style="{ width: `${row.percent}%` }" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.coverage {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.coverage__label {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
  font-weight: 700;
}

.coverage__count {
  font-variant-numeric: tabular-nums;
}

.coverage__track {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  overflow: hidden;
}

.coverage__bar {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width 300ms ease;
}
</style>
