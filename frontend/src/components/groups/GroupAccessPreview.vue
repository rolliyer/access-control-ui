<script setup lang="ts">
import { computed } from 'vue'
import ResourceChips from '@/components/access/ResourceChips.vue'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import type { Group } from '@/types/access-control'

/** What joining the group gives: its roles and what they can see. */
const { group } = defineProps<{ group: Group }>()

const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()

const roles = computed(() =>
  groupsStore
    .rolesOf(group.groupId)
    .map((gr) => rolesStore.byId.get(gr.roleId))
    .filter((r) => r !== undefined),
)
const permissions = computed(() => roles.value.flatMap((r) => rolesStore.permissionsFor(r.roleId)))
const domains = computed(() => [
  ...new Set(
    permissions.value.filter((p) => p.resourceType === 'domain').map((p) => p.resourceKey),
  ),
])
const tiers = computed(() => [
  ...new Set(permissions.value.filter((p) => p.resourceType === 'tier').map((p) => p.resourceKey)),
])
</script>

<template>
  <div class="preview">
    <p>
      <strong>Roles:</strong>
      {{ roles.length ? roles.map((r) => r.roleName).join(', ') : 'None yet' }}
    </p>
    <p>
      <strong>Will see:</strong>
      <ResourceChips :domains :tiers empty-label="Nothing — this group has no roles" />
    </p>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-accent-subtle);
}

.preview p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
