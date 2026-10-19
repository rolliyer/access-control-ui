<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AccessMatrix from '@/components/dashboard/AccessMatrix.vue'
import DomainCoverage from '@/components/dashboard/DomainCoverage.vue'
import ExpiringGrantsList from '@/components/dashboard/ExpiringGrantsList.vue'
import AddUserModal from '@/components/users/AddUserModal.vue'
import { useUserSearch } from '@/composables/useUserSearch'
import { RouteName } from '@/router/route-names'
import { useGrantsStore } from '@/stores/grants'
import { useRolesStore } from '@/stores/roles'
import { useUsersStore } from '@/stores/users'
import { EXPIRING_SOON_DAYS } from '@/domain/grants'
import type { User } from '@/types/access-control'

const router = useRouter()
const usersStore = useUsersStore()
const rolesStore = useRolesStore()
const grantsStore = useGrantsStore()

const showInactive = ref(false)
const { query, status, results } = useUserSearch(() => usersStore.sorted, { status: 'active' })

function setShowInactive(value: boolean): void {
  showInactive.value = value
  status.value = value ? 'all' : 'active'
}

const addUserOpen = ref(false)

function onUserCreated(user: User): void {
  router.push({ name: RouteName.UserDetail, params: { userId: user.userId } })
}
</script>

<template>
  <div class="dashboard">
    <PageHeader
      title="Access dashboard"
      subtitle="Who can see which analytics data through the Roller analytics agent, right now."
    >
      <template #actions>
        <BaseButton @click="addUserOpen = true">+ Add user</BaseButton>
      </template>
    </PageHeader>

    <div class="dashboard__stats">
      <StatCard
        label="Active users"
        :value="usersStore.activeCount"
        :caption="`${usersStore.users.length - usersStore.activeCount} inactive`"
        :to="{ name: RouteName.Users }"
      />
      <StatCard
        label="Active roles"
        :value="rolesStore.activeRoles.length"
        :caption="`${rolesStore.permissions.length} permissions`"
        :to="{ name: RouteName.Roles }"
      />
      <StatCard
        label="Active grants"
        :value="grantsStore.activeGrants.length"
        caption="Roles currently held"
      />
      <StatCard
        label="Expiring soon"
        :value="grantsStore.expiringSoon.length"
        :caption="`Within ${EXPIRING_SOON_DAYS} days`"
      />
    </div>

    <div class="dashboard__grid">
      <BaseCard
        title="Access matrix"
        subtitle="Click a person to see their roles and grants."
        :padded="false"
        class="dashboard__matrix"
      >
        <template #actions>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="showInactive"
              @change="setShowInactive(($event.target as HTMLInputElement).checked)"
            />
            Show inactive
          </label>
        </template>
        <div class="dashboard__search">
          <SearchInput
            v-model="query"
            label="Search people"
            placeholder="Search by name, email or department…"
          />
        </div>
        <AccessMatrix v-if="results.length" :users="results" />
        <EmptyState v-else title="No matching people" message="Try a different name or email.">
          <BaseButton variant="secondary" @click="query = ''">Clear search</BaseButton>
        </EmptyState>
      </BaseCard>

      <div class="dashboard__side">
        <BaseCard title="Domain coverage" subtitle="Active users who can see each domain">
          <DomainCoverage />
        </BaseCard>
        <BaseCard title="Expiring soon" subtitle="Renew or let these lapse" :padded="false">
          <ExpiringGrantsList :grants="grantsStore.expiringSoon" />
        </BaseCard>
      </div>
    </div>

    <AddUserModal v-model:open="addUserOpen" @created="onUserCreated" />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.dashboard :deep(.page-header) {
  margin-bottom: 0;
}

.dashboard__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}

.dashboard__grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.dashboard__side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
  align-items: start;
}

.dashboard__search {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  cursor: pointer;
}

.toggle input {
  accent-color: var(--color-accent);
}

@media (max-width: 900px) {
  .dashboard__side {
    grid-template-columns: 1fr;
  }
}
</style>
