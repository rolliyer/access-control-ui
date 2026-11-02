<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ResourceChips from '@/components/access/ResourceChips.vue'
import AddMemberModal from '@/components/groups/AddMemberModal.vue'
import BulkAddMembersModal from '@/components/groups/BulkAddMembersModal.vue'
import GroupFormModal from '@/components/groups/GroupFormModal.vue'
import MembershipsTable from '@/components/groups/MembershipsTable.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { RouteName } from '@/router/route-names'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import { useUsersStore } from '@/stores/users'
import { isMembershipOpen } from '@/domain/grants'
import type { GroupMember, GroupRole } from '@/types/access-control'
import { formatDate } from '@/utils/date'

const { groupId } = defineProps<{ groupId: string }>()

const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()
const teamsStore = useTeamsStore()
const usersStore = useUsersStore()
const session = useSessionStore()

const group = computed(() => groupsStore.byId.get(groupId))
const canManage = computed(() => session.canManageTeam(group.value?.teamId))
const teamActive = computed(() => teamsStore.byId.get(group.value?.teamId ?? '')?.isActive ?? false)

// ── Roles ─────────────────────────────────────────────────────────────────

const groupRoles = computed(() => groupsStore.rolesOf(groupId))

function permissionsOf(roleId: string, type: 'domain' | 'tier'): string[] {
  return rolesStore
    .permissionsFor(roleId)
    .filter((p) => p.resourceType === type)
    .map((p) => p.resourceKey)
}

/** Roles that can still be added: team admins only see their own team's roles. */
const roleOptions = computed(() => {
  const held = new Set(groupRoles.value.map((gr) => gr.roleId))
  return rolesStore.activeRoles
    .filter((r) => !held.has(r.roleId))
    .filter((r) => session.isGlobalAdmin || r.teamId === group.value?.teamId)
    .map((r) => ({
      value: r.roleId,
      label: `${r.roleName} · ${r.teamId ? teamsStore.teamName(r.teamId) : 'no team'}`,
    }))
})
const newRoleId = ref('')

const { run: addRole, pending: addingRole } = useAsyncAction(
  async () => {
    await groupsStore.addRole(groupId, newRoleId.value)
    newRoleId.value = ''
  },
  { successMessage: 'Role added to group.' },
)

const revokeRoleTarget = ref<GroupRole | null>(null)
const revokeRoleOpen = computed({
  get: () => revokeRoleTarget.value !== null,
  set: (open) => {
    if (!open) revokeRoleTarget.value = null
  },
})
const { run: revokeRole, pending: revokingRole } = useAsyncAction(
  async () => {
    if (!revokeRoleTarget.value) return
    await groupsStore.revokeRole(revokeRoleTarget.value.groupRoleId)
    revokeRoleTarget.value = null
  },
  { successMessage: 'Role removed from group.' },
)

// ── Members ───────────────────────────────────────────────────────────────

const showHistory = ref(false)
const allMembers = computed(() =>
  [...groupsStore.membersOf(groupId)].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
)
const visibleMembers = computed(() =>
  showHistory.value ? allMembers.value : allMembers.value.filter((m) => isMembershipOpen(m)),
)
const closedCount = computed(() => allMembers.value.length - visibleMembers.value.length)

const addMemberOpen = ref(false)
const bulkAddOpen = ref(false)
const removeTarget = ref<GroupMember | null>(null)
const removeOpen = computed({
  get: () => removeTarget.value !== null,
  set: (open) => {
    if (!open) removeTarget.value = null
  },
})
const { run: removeMember, pending: removing } = useAsyncAction(
  async () => {
    if (!removeTarget.value) return
    await groupsStore.removeMember(removeTarget.value.groupMemberId)
    removeTarget.value = null
  },
  { successMessage: 'Removed from group.' },
)

// ── Group ─────────────────────────────────────────────────────────────────

const editOpen = ref(false)
const statusOpen = ref(false)
const { run: toggleActive, pending: toggling } = useAsyncAction(
  async () => {
    if (!group.value) return
    await groupsStore.update(groupId, { isActive: !group.value.isActive })
    statusOpen.value = false
  },
  { successMessage: 'Group updated.' },
)
</script>

<template>
  <div v-if="group" class="group-detail">
    <PageHeader :title="group.groupName" :subtitle="group.description ?? undefined">
      <template #eyebrow>
        <RouterLink :to="{ name: RouteName.Groups }" class="back">← All groups</RouterLink>
      </template>
      <template v-if="canManage" #actions>
        <BaseButton variant="secondary" @click="editOpen = true">Edit details</BaseButton>
        <BaseButton :variant="group.isActive ? 'danger' : 'secondary'" @click="statusOpen = true">
          {{ group.isActive ? 'Retire' : 'Reactivate' }}
        </BaseButton>
        <BaseButton :disabled="!group.isActive" @click="addMemberOpen = true">
          + Add Person
        </BaseButton>
        <BaseButton :disabled="!group.isActive" @click="bulkAddOpen = true">
          + Add Persons
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="!group.isActive || !teamActive" class="notice">
      {{
        !group.isActive
          ? 'This group is retired, so it gives nobody access.'
          : 'This group’s team is retired, so it gives nobody access.'
      }}
    </p>

    <div class="group-detail__grid">
      <BaseCard title="About">
        <dl class="meta">
          <div>
            <dt>Team</dt>
            <dd>{{ teamsStore.teamName(group.teamId) }}</dd>
          </div>
          <div>
            <dt>Key</dt>
            <dd>
              <code>{{ group.groupKey }}</code>
            </dd>
          </div>
          <div>
            <dt>Entra group</dt>
            <dd>{{ group.entraGroupId ?? 'Not linked — members managed here' }}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{{ formatDate(group.createdAt) }} by {{ group.createdBy }}</dd>
          </div>
        </dl>
      </BaseCard>

      <BaseCard title="Roles" subtitle="Every member gets all of these" :padded="false">
        <ul v-if="groupRoles.length" class="roles">
          <li v-for="gr in groupRoles" :key="gr.groupRoleId" class="roles__item">
            <div>
              <strong>{{ rolesStore.byId.get(gr.roleId)?.roleName ?? 'Unknown role' }}</strong>
              <BaseBadge v-if="rolesStore.byId.get(gr.roleId)?.isActive === false" variant="muted">
                Retired
              </BaseBadge>
              <ResourceChips
                :domains="permissionsOf(gr.roleId, 'domain')"
                :tiers="permissionsOf(gr.roleId, 'tier')"
                empty-label="No permissions"
              />
            </div>
            <BaseButton v-if="canManage" variant="ghost" size="sm" @click="revokeRoleTarget = gr">
              Remove
            </BaseButton>
          </li>
        </ul>
        <EmptyState
          v-else
          title="No roles yet"
          message="Members of this group can't see anything until it has a role."
        />
        <form
          v-if="canManage && group.isActive"
          class="roles__add"
          novalidate
          @submit.prevent="newRoleId && addRole()"
        >
          <BaseSelect
            v-model="newRoleId"
            label="Add a role"
            placeholder="Choose a role…"
            :options="roleOptions"
            :hint="
              session.isGlobalAdmin
                ? undefined
                : 'Only your team’s roles are listed. Ask a global admin for others.'
            "
          />
          <BaseButton
            type="submit"
            variant="secondary"
            :disabled="!newRoleId"
            :loading="addingRole"
          >
            Add role
          </BaseButton>
        </form>
      </BaseCard>
    </div>

    <BaseCard
      title="Members"
      :subtitle="showHistory ? 'Everyone, newest first' : 'Current and upcoming members'"
      :padded="false"
    >
      <template #actions>
        <BaseButton variant="ghost" size="sm" @click="showHistory = !showHistory">
          {{ showHistory ? 'Hide history' : `Show history (${closedCount})` }}
        </BaseButton>
      </template>
      <MembershipsTable
        v-if="visibleMembers.length"
        :members="visibleMembers"
        show="person"
        @remove="removeTarget = $event"
      />
      <EmptyState v-else title="No members" message="Add people to give them this group's roles.">
        <template v-if="canManage && group.isActive">
          <BaseButton @click="addMemberOpen = true">+ Add Person</BaseButton>
          <BaseButton @click="bulkAddOpen = true">+ Add Persons</BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <GroupFormModal v-model:open="editOpen" :group="group" />
    <AddMemberModal v-model:open="addMemberOpen" :group="group" />
    <BulkAddMembersModal v-model:open="bulkAddOpen" :group="group" />
    <ConfirmDialog
      v-model:open="statusOpen"
      :title="group.isActive ? 'Retire group?' : 'Reactivate group?'"
      :message="
        group.isActive
          ? `All ${groupsStore.activeMemberCount(groupId)} member(s) lose this group's access within 5 minutes. Nothing is deleted.`
          : `Members with a valid membership get this group's access again.`
      "
      :confirm-label="group.isActive ? 'Retire' : 'Reactivate'"
      :variant="group.isActive ? 'danger' : 'primary'"
      :loading="toggling"
      @confirm="toggleActive"
    />
    <ConfirmDialog
      v-model:open="removeOpen"
      title="Remove from group?"
      :message="`${usersStore.byId.get(removeTarget?.userId ?? '')?.email} loses this group's access within 5 minutes. The record stays in the history.`"
      confirm-label="Remove"
      variant="danger"
      :loading="removing"
      @confirm="removeMember"
    />
    <ConfirmDialog
      v-model:open="revokeRoleOpen"
      title="Remove role from group?"
      :message="`Every member loses ${rolesStore.byId.get(revokeRoleTarget?.roleId ?? '')?.roleName} (unless another group gives it) within 5 minutes.`"
      confirm-label="Remove role"
      variant="danger"
      :loading="revokingRole"
      @confirm="revokeRole"
    />
  </div>

  <EmptyState v-else title="Group not found" message="The link may be wrong.">
    <BaseButton :to="{ name: RouteName.Groups }" variant="secondary">Back to groups</BaseButton>
  </EmptyState>
</template>

<style scoped>
.group-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-detail :deep(.page-header) {
  margin-bottom: 0;
}

.back {
  display: inline-block;
  margin-bottom: var(--space-2);
  font-weight: 700;
}

.notice {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
}

.group-detail__grid {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr);
  gap: var(--space-5);
  align-items: start;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
}

.meta dt {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.roles {
  margin: 0;
  padding: 0;
  list-style: none;
}

.roles__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
}

.roles__item + .roles__item {
  border-top: 1px solid var(--color-border);
}

.roles__item > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.roles__add {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
}

.roles__add > :first-child {
  flex: 1;
}

@media (max-width: 900px) {
  .group-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
