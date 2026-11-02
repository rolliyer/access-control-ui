<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
import { RouteName } from '@/router/route-names'
import { useGroupsStore } from '@/stores/groups'
import { useUsersStore } from '@/stores/users'
import { EXPIRING_SOON_DAYS } from '@/domain/grants'
import type { GroupMember } from '@/types/access-control'
import { formatDate, formatRelative } from '@/utils/date'
import { fullName } from '@/utils/user'

defineProps<{ members: readonly GroupMember[] }>()

const usersStore = useUsersStore()
const groupsStore = useGroupsStore()

function userName(userId: string): string {
  const user = usersStore.byId.get(userId)
  return user ? fullName(user) : 'Unknown user'
}
</script>

<template>
  <ul v-if="members.length" class="expiring">
    <li v-for="member in members" :key="member.groupMemberId" class="expiring__item">
      <RouterLink
        :to="{ name: RouteName.UserDetail, params: { userId: member.userId } }"
        class="expiring__link"
      >
        <span>
          <strong>{{ userName(member.userId) }}</strong>
          <small>{{ groupsStore.byId.get(member.groupId)?.groupName }}</small>
        </span>
        <span class="expiring__when" :title="formatDate(member.expiresAt)">
          {{ formatRelative(member.expiresAt ?? '') }}
        </span>
      </RouterLink>
    </li>
  </ul>
  <EmptyState
    v-else
    title="Nothing expiring soon"
    :message="`No group memberships end in the next ${EXPIRING_SOON_DAYS} days.`"
  />
</template>

<style scoped>
.expiring {
  margin: 0;
  padding: 0;
  list-style: none;
}

.expiring__item + .expiring__item {
  border-top: 1px solid var(--color-border);
}

.expiring__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  color: var(--color-text);
}

.expiring__link:hover {
  background: var(--color-accent-subtle);
  text-decoration: none;
  color: var(--color-text);
}

.expiring__link span:first-child {
  display: flex;
  flex-direction: column;
}

.expiring__link small {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.expiring__when {
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-warning-bg);
  font-size: var(--text-xs);
  font-weight: 700;
  white-space: nowrap;
}
</style>
