<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import GrantDetailsFields from '@/components/access/GrantDetailsFields.vue'
import UserFormFields from './UserFormFields.vue'
import { useUserForm } from '@/composables/useUserForm'
import { useGrantForm } from '@/composables/useGrantForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useUsersStore } from '@/stores/users'
import { useRolesStore } from '@/stores/roles'
import { useGrantsStore } from '@/stores/grants'
import { useNotificationsStore } from '@/stores/notifications'
import { appConfig } from '@/config'
import type { User } from '@/types/access-control'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [user: User] }>()

const usersStore = useUsersStore()
const rolesStore = useRolesStore()
const grantsStore = useGrantsStore()
const notifications = useNotificationsStore()

const userForm = useUserForm()
const grantForm = useGrantForm(() => userForm.values.email, appConfig.actorEmail)
const selectedRoleIds = ref<string[]>([])

const assigningRoles = computed(() => selectedRoleIds.value.length > 0)

watch(open, (isOpen) => {
  if (!isOpen) return
  userForm.reset()
  grantForm.reset()
  selectedRoleIds.value = []
})

function toggleRole(roleId: string): void {
  selectedRoleIds.value = selectedRoleIds.value.includes(roleId)
    ? selectedRoleIds.value.filter((id) => id !== roleId)
    : [...selectedRoleIds.value, roleId]
}

const { run: save, pending } = useAsyncAction(async () => {
  const user = await usersStore.create(userForm.toInput())
  const timing = assigningRoles.value ? grantForm.toTiming() : null

  // Grants are created one by one so a failure is reported per role.
  const failed: string[] = []
  for (const roleId of timing ? selectedRoleIds.value : []) {
    try {
      await grantsStore.grant({ userId: user.userId, roleId, ...timing! })
    } catch {
      failed.push(rolesStore.byId.get(roleId)?.roleName ?? roleId)
    }
  }

  if (failed.length) notifications.error(`User added, but these roles failed: ${failed.join(', ')}`)
  else notifications.success(`${user.email} added.`)
  return user
})

async function submit(): Promise<void> {
  const userValid = userForm.validate()
  const grantValid = !assigningRoles.value || grantForm.validate()
  if (!userValid || !grantValid) return

  const user = await save()
  if (user) {
    emit('created', user)
    open.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Add user"
    description="Add a person who can be given access to the analytics agent."
    size="lg"
  >
    <form id="add-user-form" class="add-user" novalidate @submit.prevent="submit">
      <UserFormFields
        v-model:email="userForm.values.email"
        v-model:first-name="userForm.values.firstName"
        v-model:last-name="userForm.values.lastName"
        v-model:department="userForm.values.department"
        :errors="userForm.errors.value"
        :departments="usersStore.departments"
      />

      <section class="add-user__roles" aria-labelledby="add-user-roles-title">
        <h3 id="add-user-roles-title" class="add-user__section-title">
          Assign roles <span class="text-muted">(optional)</span>
        </h3>
        <div class="add-user__role-list">
          <button
            v-for="role in rolesStore.activeRoles"
            :key="role.roleId"
            type="button"
            class="role-toggle"
            :class="{ 'is-selected': selectedRoleIds.includes(role.roleId) }"
            :aria-pressed="selectedRoleIds.includes(role.roleId)"
            @click="toggleRole(role.roleId)"
          >
            <strong>{{ role.roleName }}</strong>
            <span class="role-toggle__perms">
              <BaseBadge
                v-for="p in rolesStore.permissionsFor(role.roleId)"
                :key="p.rolePermissionId"
              >
                {{ p.resourceKey }}
              </BaseBadge>
            </span>
          </button>
        </div>

        <GrantDetailsFields
          v-if="assigningRoles"
          v-model:start-date="grantForm.values.startDate"
          v-model:expiry-date="grantForm.values.expiryDate"
          v-model:granted-by="grantForm.values.grantedBy"
          v-model:reason="grantForm.values.reason"
          :errors="grantForm.errors.value"
        />
      </section>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="add-user-form" :loading="pending">
        {{ assigningRoles ? `Add user & ${selectedRoleIds.length} role(s)` : 'Add user' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.add-user {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.add-user__roles {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.add-user__section-title {
  font-size: var(--text-md);
}

.add-user__role-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
}

.role-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition),
    background var(--transition);
}

.role-toggle:hover {
  border-color: var(--color-accent);
}

.role-toggle.is-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.role-toggle__perms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
