<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RoleCard from '@/components/roles/RoleCard.vue'
import RoleFormModal from '@/components/roles/RoleFormModal.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useGrantsStore } from '@/stores/grants'
import { useRolesStore } from '@/stores/roles'
import type { Role } from '@/types/access-control'

const rolesStore = useRolesStore()
const grantsStore = useGrantsStore()

const formOpen = ref(false)
const editingRole = ref<Role | null>(null)

function openCreate(): void {
  editingRole.value = null
  formOpen.value = true
}

function openEdit(role: Role): void {
  editingRole.value = role
  formOpen.value = true
}

const toggleTarget = ref<Role | null>(null)
const toggleConfirmOpen = computed({
  get: () => toggleTarget.value !== null,
  set: (open) => {
    if (!open) toggleTarget.value = null
  },
})

const toggleMessage = computed(() => {
  const role = toggleTarget.value
  if (!role) return ''
  const holders = grantsStore.activeHolderCount(role.roleId)
  return role.isActive
    ? `Retiring ${role.roleName} removes this access from ${holders} current holder(s) within 5 minutes. Grants are kept and come back if you reactivate it.`
    : `Reactivating ${role.roleName} restores access for anyone with a valid grant.`
})

const { run: toggleActive, pending: toggling } = useAsyncAction(
  async () => {
    const role = toggleTarget.value
    if (!role) return
    await rolesStore.setActive(role.roleId, !role.isActive)
    toggleTarget.value = null
  },
  { successMessage: 'Role updated.' },
)
</script>

<template>
  <div>
    <PageHeader
      title="Roles & permissions"
      subtitle="A role is a keycard type: it opens the domains listed on it. Access only exists where a role says so."
    >
      <template #actions>
        <BaseButton @click="openCreate">+ New role</BaseButton>
      </template>
    </PageHeader>

    <div v-if="rolesStore.sorted.length" class="roles-grid">
      <RoleCard
        v-for="role in rolesStore.sorted"
        :key="role.roleId"
        :role="role"
        :permissions="rolesStore.permissionsFor(role.roleId)"
        :holder-count="grantsStore.activeHolderCount(role.roleId)"
        @edit="openEdit"
        @toggle-active="toggleTarget = $event"
      />
    </div>
    <EmptyState v-else title="No roles yet" message="Create a role, then grant it to people.">
      <BaseButton @click="openCreate">+ New role</BaseButton>
    </EmptyState>

    <RoleFormModal v-model:open="formOpen" :role="editingRole" />
    <ConfirmDialog
      v-model:open="toggleConfirmOpen"
      :title="toggleTarget?.isActive ? 'Retire role?' : 'Reactivate role?'"
      :message="toggleMessage"
      :confirm-label="toggleTarget?.isActive ? 'Retire' : 'Reactivate'"
      :variant="toggleTarget?.isActive ? 'danger' : 'primary'"
      :loading="toggling"
      @confirm="toggleActive"
    />
  </div>
</template>

<style scoped>
.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-5);
}
</style>
