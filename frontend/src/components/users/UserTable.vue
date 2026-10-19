<script setup lang="ts">
import { useRouter } from 'vue-router'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import ResourceChips from '@/components/access/ResourceChips.vue'
import UserStatusBadge from './UserStatusBadge.vue'
import { RouteName } from '@/router/route-names'
import { useAccessStore } from '@/stores/access'
import { useRolesStore } from '@/stores/roles'
import type { User } from '@/types/access-control'
import { fullName } from '@/utils/user'

defineProps<{ users: readonly User[] }>()

const router = useRouter()
const access = useAccessStore()
const rolesStore = useRolesStore()

function roleName(roleKey: string): string {
  return rolesStore.roles.find((r) => r.roleKey === roleKey)?.roleName ?? roleKey
}

function open(user: User): void {
  router.push({ name: RouteName.UserDetail, params: { userId: user.userId } })
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th scope="col">Department</th>
          <th scope="col">Roles</th>
          <th scope="col">Can see now</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.userId"
          class="is-clickable"
          tabindex="0"
          @click="open(user)"
          @keydown.enter="open(user)"
        >
          <td>
            <div class="person">
              <UserAvatar :user="user" size="sm" />
              <div class="person__text">
                <RouterLink
                  :to="{ name: RouteName.UserDetail, params: { userId: user.userId } }"
                  class="person__name"
                  @click.stop
                >
                  {{ fullName(user) }}
                </RouterLink>
                <span class="person__email">{{ user.email }}</span>
              </div>
            </div>
          </td>
          <td>{{ user.department ?? '—' }}</td>
          <td>
            <span v-if="access.accessFor(user.userId).roleKeys.length" class="roles">
              {{ access.accessFor(user.userId).roleKeys.map(roleName).join(', ') }}
            </span>
            <span v-else class="text-muted">None</span>
          </td>
          <td>
            <ResourceChips
              :domains="access.accessFor(user.userId).domains"
              :tiers="access.accessFor(user.userId).tiers"
            />
          </td>
          <td><UserStatusBadge :active="user.isActive" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 220px;
}

.person__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.person__name {
  font-weight: 700;
  color: var(--color-text);
}

.person__email {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.roles {
  white-space: nowrap;
}
</style>
