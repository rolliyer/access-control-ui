<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import GrantStatusBadge from '@/components/access/GrantStatusBadge.vue'
import { RouteName } from '@/router/route-names'
import { useGroupsStore } from '@/stores/groups'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import { useUsersStore } from '@/stores/users'
import { isMembershipOpen, membershipWindow } from '@/domain/grants'
import type { GroupMember } from '@/types/access-control'
import { formatDate, formatRelative } from '@/utils/date'
import { fullName } from '@/utils/user'

/**
 * Group memberships. `show` picks the first column: the group (on a person's
 * page) or the person (on a group's page).
 */
defineProps<{ members: readonly GroupMember[]; show: 'group' | 'person' }>()
const emit = defineEmits<{ remove: [member: GroupMember] }>()

const groupsStore = useGroupsStore()
const teamsStore = useTeamsStore()
const usersStore = useUsersStore()
const session = useSessionStore()

function canRemove(member: GroupMember): boolean {
  const group = groupsStore.byId.get(member.groupId)
  return isMembershipOpen(member) && session.canManageTeam(group?.teamId)
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">{{ show === 'group' ? 'Group' : 'Person' }}</th>
          <th scope="col">Status</th>
          <th scope="col">Starts</th>
          <th scope="col">Expires</th>
          <th scope="col">Approved by</th>
          <th scope="col">Reason</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.groupMemberId">
          <td v-if="show === 'group'">
            <RouterLink :to="{ name: RouteName.GroupDetail, params: { groupId: member.groupId } }">
              <strong>{{
                groupsStore.byId.get(member.groupId)?.groupName ?? 'Unknown group'
              }}</strong>
            </RouterLink>
            <small class="text-muted cell-sub">
              {{ teamsStore.teamName(groupsStore.byId.get(member.groupId)?.teamId) }}
            </small>
          </td>
          <td v-else>
            <RouterLink :to="{ name: RouteName.UserDetail, params: { userId: member.userId } }">
              <strong>{{
                usersStore.byId.get(member.userId)
                  ? fullName(usersStore.byId.get(member.userId)!)
                  : 'Unknown person'
              }}</strong>
            </RouterLink>
            <small class="text-muted cell-sub">{{
              usersStore.byId.get(member.userId)?.email
            }}</small>
          </td>
          <td><GrantStatusBadge :access="membershipWindow(member)" /></td>
          <td>{{ formatDate(member.addedAt) }}</td>
          <td>
            <template v-if="member.removedAt">
              Removed {{ formatDate(member.removedAt) }}
              <span class="text-muted">by {{ member.removedBy }}</span>
            </template>
            <template v-else-if="member.expiresAt">
              {{ formatDate(member.expiresAt) }}
              <span class="text-muted">({{ formatRelative(member.expiresAt) }})</span>
            </template>
            <span v-else class="text-muted">Never</span>
          </td>
          <td>{{ member.approvedBy }}</td>
          <td>{{ member.reason ?? '—' }}</td>
          <td class="actions">
            <BaseButton
              v-if="canRemove(member)"
              variant="danger"
              size="sm"
              @click="emit('remove', member)"
            >
              Remove
            </BaseButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cell-sub {
  display: block;
  font-size: var(--text-xs);
}

.actions {
  text-align: right;
}
</style>
