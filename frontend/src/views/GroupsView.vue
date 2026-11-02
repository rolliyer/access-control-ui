<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import GroupFormModal from '@/components/groups/GroupFormModal.vue'
import { RouteName } from '@/router/route-names'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import type { Group } from '@/types/access-control'

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()
const teamsStore = useTeamsStore()
const session = useSessionStore()

const query = ref('')
const teamFilter = computed({
  get: () => (typeof route.query.team === 'string' ? route.query.team : ''),
  set: (team: string) => router.replace({ query: team ? { team } : {} }),
})
const teamOptions = computed(() => [
  { value: '', label: 'All teams' },
  ...teamsStore.sorted.map((t) => ({ value: t.teamId, label: t.teamName })),
])

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  return groupsStore.sorted.filter(
    (g) =>
      (!teamFilter.value || g.teamId === teamFilter.value) &&
      (!q || g.groupName.toLowerCase().includes(q) || g.groupKey.includes(q)),
  )
})

const canCreate = computed(
  () =>
    session.isGlobalAdmin || teamsStore.activeTeams.some((t) => session.canManageTeam(t.teamId)),
)

function roleNames(group: Group): string {
  return (
    groupsStore
      .rolesOf(group.groupId)
      .map((gr) => rolesStore.byId.get(gr.roleId)?.roleName ?? 'Unknown role')
      .join(', ') || '—'
  )
}

function open(group: Group): void {
  router.push({ name: RouteName.GroupDetail, params: { groupId: group.groupId } })
}

const formOpen = ref(false)
</script>

<template>
  <div>
    <PageHeader
      title="Groups"
      subtitle="People get access by joining a group. Each group belongs to a team and gives its members the group's roles."
    >
      <template v-if="canCreate" #actions>
        <BaseButton @click="formOpen = true">+ New group</BaseButton>
      </template>
    </PageHeader>

    <BaseCard :padded="false">
      <div class="filters">
        <SearchInput v-model="query" label="Search groups" placeholder="Search by name or key…" />
        <BaseSelect v-model="teamFilter" label="Team" :options="teamOptions" />
      </div>
      <div v-if="results.length" class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Team</th>
              <th scope="col">Roles</th>
              <th scope="col">Members</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="group in results"
              :key="group.groupId"
              class="is-clickable"
              tabindex="0"
              @click="open(group)"
              @keydown.enter="open(group)"
            >
              <td>
                <strong>{{ group.groupName }}</strong>
                <code class="cell-sub">{{ group.groupKey }}</code>
              </td>
              <td>{{ teamsStore.teamName(group.teamId) }}</td>
              <td>{{ roleNames(group) }}</td>
              <td>{{ groupsStore.activeMemberCount(group.groupId) }}</td>
              <td>
                <BaseBadge v-if="!group.isActive" variant="muted">Retired</BaseBadge>
                <BaseBadge v-else variant="success" dot>Active</BaseBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else title="No matching groups" message="Try another search or team.">
        <BaseButton v-if="canCreate" @click="formOpen = true">+ New group</BaseButton>
      </EmptyState>
    </BaseCard>

    <GroupFormModal v-model:open="formOpen" :team-id="teamFilter || null" @saved="open" />
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(160px, 1fr);
  gap: var(--space-4);
  align-items: end;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.cell-sub {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

@media (max-width: 560px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
