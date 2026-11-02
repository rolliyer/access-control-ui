<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RoleCard from '@/components/roles/RoleCard.vue'
import RoleFormModal from '@/components/roles/RoleFormModal.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAccessStore } from '@/stores/access'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import type { Role } from '@/types/access-control'

const rolesStore = useRolesStore()
const access = useAccessStore()
const session = useSessionStore()

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
  const holders = access.holderCount(role.roleKey)
  return role.isActive
    ? `Retiring ${role.roleName} removes this access from ${holders} person(s) within 5 minutes. Groups keep it and it comes back if you reactivate it.`
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
      subtitle="A role is a keycard type: it opens the domains listed on it. Groups hand roles to people. Only global admins change roles."
    >
      <template v-if="session.isGlobalAdmin" #actions>
        <BaseButton @click="openCreate">+ New role</BaseButton>
      </template>
    </PageHeader>

    <div v-if="rolesStore.sorted.length" class="roles-grid">
      <RoleCard
        v-for="role in rolesStore.sorted"
        :key="role.roleId"
        :role="role"
        :permissions="rolesStore.permissionsFor(role.roleId)"
        :holder-count="access.holderCount(role.roleKey)"
        :editable="session.isGlobalAdmin"
        @edit="openEdit"
        @toggle-active="toggleTarget = $event"
      />
    </div>
    <EmptyState v-else title="No roles yet" message="Create a role, then add it to groups.">
      <BaseButton v-if="session.isGlobalAdmin" @click="openCreate">+ New role</BaseButton>
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
