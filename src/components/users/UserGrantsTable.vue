<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import GrantStatusBadge from '@/components/access/GrantStatusBadge.vue'
import { useRolesStore } from '@/stores/roles'
import { isGrantOpen } from '@/domain/grants'
import type { UserRole } from '@/types/access-control'
import { formatDate, formatRelative } from '@/utils/date'

defineProps<{ grants: readonly UserRole[] }>()
const emit = defineEmits<{ revoke: [grant: UserRole] }>()

const rolesStore = useRolesStore()
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Role</th>
          <th scope="col">Status</th>
          <th scope="col">Starts</th>
          <th scope="col">Expires</th>
          <th scope="col">Approved by</th>
          <th scope="col">Reason</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="grant in grants" :key="grant.userRoleId">
          <td>
            <strong>{{ rolesStore.byId.get(grant.roleId)?.roleName ?? 'Unknown role' }}</strong>
            <BaseBadge v-if="rolesStore.byId.get(grant.roleId)?.isActive === false" variant="muted">
              Retired
            </BaseBadge>
          </td>
          <td><GrantStatusBadge :grant="grant" /></td>
          <td>{{ formatDate(grant.grantedAt) }}</td>
          <td>
            <template v-if="grant.revokedAt">
              Revoked {{ formatDate(grant.revokedAt) }}
              <span class="text-muted">by {{ grant.revokedBy }}</span>
            </template>
            <template v-else-if="grant.expiresAt">
              {{ formatDate(grant.expiresAt) }}
              <span class="text-muted">({{ formatRelative(grant.expiresAt) }})</span>
            </template>
            <span v-else class="text-muted">Never</span>
          </td>
          <td>{{ grant.grantedBy }}</td>
          <td>{{ grant.reason ?? '—' }}</td>
          <td class="actions">
            <BaseButton
              v-if="isGrantOpen(grant)"
              variant="danger"
              size="sm"
              @click="emit('revoke', grant)"
            >
              Revoke
            </BaseButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.actions {
  text-align: right;
}
</style>
