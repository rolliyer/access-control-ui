<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ResourceChips from '@/components/access/ResourceChips.vue'
import GrantDetailsFields from '@/components/access/GrantDetailsFields.vue'
import { useGrantForm } from '@/composables/useGrantForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useRolesStore } from '@/stores/roles'
import { useGrantsStore } from '@/stores/grants'
import { isGrantOpen } from '@/domain/grants'
import { appConfig } from '@/config'
import type { User } from '@/types/access-control'

const open = defineModel<boolean>('open', { required: true })
const { user } = defineProps<{ user: User }>()

const rolesStore = useRolesStore()
const grantsStore = useGrantsStore()

const roleId = ref('')
const roleError = ref<string | null>(null)
const form = useGrantForm(() => user.email, appConfig.actorEmail)

/** Roles the user already holds (active or scheduled) can't be granted twice. */
const heldRoleIds = computed(
  () =>
    new Set(
      grantsStore
        .grantsFor(user.userId)
        .filter((g) => isGrantOpen(g))
        .map((g) => g.roleId),
    ),
)

const roleOptions = computed(() =>
  rolesStore.activeRoles.map((role) => ({
    value: role.roleId,
    label: heldRoleIds.value.has(role.roleId) ? `${role.roleName} (already held)` : role.roleName,
    disabled: heldRoleIds.value.has(role.roleId),
  })),
)

const selectedRole = computed(() => rolesStore.byId.get(roleId.value))
const selectedPermissions = computed(() =>
  selectedRole.value ? rolesStore.permissionsFor(selectedRole.value.roleId) : [],
)

watch(open, (isOpen) => {
  if (!isOpen) return
  roleId.value = ''
  roleError.value = null
  form.reset()
})

// Default the approver to the role's approver unless it is the grantee.
watch(selectedRole, (role) => {
  const approver = role?.approverEmail
  if (approver && approver !== user.email) form.values.grantedBy = approver
})

const { run: grant, pending } = useAsyncAction(
  () => grantsStore.grant({ userId: user.userId, roleId: roleId.value, ...form.toTiming() }),
  { successMessage: 'Role granted.' },
)

async function submit(): Promise<void> {
  roleError.value = roleId.value ? null : 'Choose a role.'
  const valid = form.validate()
  if (roleError.value || !valid) return
  if (await grant()) open.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Grant role"
    :description="`Give ${user.email} a role. Changes reach the agent within 5 minutes.`"
  >
    <form id="grant-role-form" class="grant-form" novalidate @submit.prevent="submit">
      <BaseSelect
        v-model="roleId"
        label="Role"
        placeholder="Choose a role…"
        :options="roleOptions"
        required
        :error="roleError"
      />
      <div v-if="selectedRole" class="grant-form__preview">
        <p class="text-muted">{{ selectedRole.description }}</p>
        <p>
          <strong>Will see:</strong>
          <ResourceChips
            :domains="
              selectedPermissions
                .filter((p) => p.resourceType === 'domain')
                .map((p) => p.resourceKey)
            "
            :tiers="
              selectedPermissions.filter((p) => p.resourceType === 'tier').map((p) => p.resourceKey)
            "
            empty-label="Nothing yet — this role has no permissions"
          />
        </p>
      </div>
      <GrantDetailsFields
        v-model:start-date="form.values.startDate"
        v-model:expiry-date="form.values.expiryDate"
        v-model:granted-by="form.values.grantedBy"
        v-model:reason="form.values.reason"
        :errors="form.errors.value"
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="grant-role-form" :loading="pending">Grant role</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.grant-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.grant-form__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-accent-subtle);
}

.grant-form__preview p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
