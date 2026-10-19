<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import AddUserModal from '@/components/users/AddUserModal.vue'
import UserTable from '@/components/users/UserTable.vue'
import { useUserSearch, type UserStatusFilter } from '@/composables/useUserSearch'
import { RouteName } from '@/router/route-names'
import { useUsersStore } from '@/stores/users'
import type { User } from '@/types/access-control'

const route = useRoute()
const router = useRouter()
const usersStore = useUsersStore()

const STATUSES: readonly UserStatusFilter[] = ['all', 'active', 'inactive']

function queryParam(name: string): string {
  const value = route.query[name]
  return typeof value === 'string' ? value : ''
}

const initialStatus = queryParam('status') as UserStatusFilter
const { query, status, department, results, isFiltered, reset } = useUserSearch(
  () => usersStore.sorted,
  {
    query: queryParam('q'),
    status: STATUSES.includes(initialStatus) ? initialStatus : 'all',
    department: queryParam('department'),
  },
)

// Keep filters in the URL so searches can be shared and survive reloads.
watch([query, status, department], ([q, s, d]) => {
  router.replace({
    query: {
      ...(q ? { q } : {}),
      ...(s !== 'all' ? { status: s } : {}),
      ...(d ? { department: d } : {}),
    },
  })
})

const summary = computed(() =>
  isFiltered.value
    ? `${results.value.length} of ${usersStore.users.length} people`
    : `${usersStore.users.length} people`,
)

const addUserOpen = ref(false)

function onUserCreated(user: User): void {
  router.push({ name: RouteName.UserDetail, params: { userId: user.userId } })
}
</script>

<template>
  <div>
    <PageHeader title="Users" subtitle="Find a person to see their roles and what they can access.">
      <template #actions>
        <BaseButton @click="addUserOpen = true">+ Add user</BaseButton>
      </template>
    </PageHeader>

    <BaseCard :padded="false">
      <div class="filters">
        <SearchInput
          v-model="query"
          label="Search users"
          placeholder="Search by name, email or department…"
        />
        <label class="filters__select">
          <span class="visually-hidden">Status</span>
          <select v-model="status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label class="filters__select">
          <span class="visually-hidden">Department</span>
          <select v-model="department">
            <option value="">All departments</option>
            <option v-for="d in usersStore.departments" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
        <span class="filters__summary" aria-live="polite">{{ summary }}</span>
      </div>

      <UserTable v-if="results.length" :users="results" />
      <EmptyState
        v-else-if="isFiltered"
        title="No matching people"
        message="Nobody matches these filters. Check the spelling or add them as a new user."
      >
        <BaseButton variant="secondary" @click="reset">Clear filters</BaseButton>
      </EmptyState>
      <EmptyState v-else title="No users yet" message="Add the first person to get started.">
        <BaseButton @click="addUserOpen = true">+ Add user</BaseButton>
      </EmptyState>
    </BaseCard>

    <AddUserModal v-model:open="addUserOpen" @created="onUserCreated" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.filters > .search {
  min-width: 240px;
}

.filters__select select {
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-input-text);
  font-weight: 500;
}

.filters__summary {
  margin-left: auto;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
