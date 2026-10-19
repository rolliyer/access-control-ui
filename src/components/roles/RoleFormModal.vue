<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PermissionPicker from '@/components/access/PermissionPicker.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useCatalogStore } from '@/stores/catalog'
import { useRolesStore } from '@/stores/roles'
import type { PermissionRef, Role } from '@/types/access-control'
import {
  normalizeEmail,
  toRoleKey,
  validateEmail,
  validateRequired,
  validateRoleKey,
} from '@/domain/validation'

const open = defineModel<boolean>('open', { required: true })
/** Pass a role to edit it; omit to create a new one. */
const { role = null } = defineProps<{ role?: Role | null }>()

const rolesStore = useRolesStore()
const catalog = useCatalogStore()
const isEdit = computed(() => role !== null)

const values = reactive({
  roleName: '',
  roleKey: '',
  description: '',
  ownerTeam: '',
  approverEmail: '',
})
const permissions = ref<PermissionRef[]>([])
const keyEdited = ref(false)
const submitted = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  values.roleName = role?.roleName ?? ''
  values.roleKey = role?.roleKey ?? ''
  values.description = role?.description ?? ''
  values.ownerTeam = role?.ownerTeam ?? ''
  values.approverEmail = role?.approverEmail ?? ''
  permissions.value = role
    ? rolesStore.permissionsFor(role.roleId).map(({ resourceType, resourceKey }) => ({
        resourceType,
        resourceKey,
      }))
    : []
  keyEdited.value = false
  submitted.value = false
})

// Suggest a key from the name until the admin types their own.
watch(
  () => values.roleName,
  (name) => {
    if (!isEdit.value && !keyEdited.value) values.roleKey = toRoleKey(name)
  },
)

function onKeyInput(value: string): void {
  keyEdited.value = true
  values.roleKey = value
}

const allErrors = computed(() => ({
  roleName: validateRequired(values.roleName, 'Role name'),
  roleKey: isEdit.value ? null : validateRoleKey(values.roleKey),
  approverEmail: values.approverEmail.trim() ? validateEmail(values.approverEmail) : null,
}))
const errors = computed(() =>
  submitted.value ? allErrors.value : { roleName: null, roleKey: null, approverEmail: null },
)

const { run: save, pending } = useAsyncAction(
  async () => {
    const details = {
      roleName: values.roleName.trim(),
      description: values.description.trim() || null,
      ownerTeam: values.ownerTeam.trim() || null,
      approverEmail: values.approverEmail.trim() ? normalizeEmail(values.approverEmail) : null,
    }
    if (role) {
      await rolesStore.update(role.roleId, details)
      await rolesStore.setPermissions(role.roleId, permissions.value)
      return role
    }
    return rolesStore.create({ ...details, roleKey: values.roleKey }, permissions.value)
  },
  { successMessage: () => (isEdit.value ? 'Role updated.' : 'Role created.') },
)

async function submit(): Promise<void> {
  submitted.value = true
  if (Object.values(allErrors.value).some(Boolean)) return
  if (await save()) open.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="isEdit ? `Edit ${role?.roleName}` : 'New role'"
    description="Name roles after the job (e.g. Support Analyst), not the team."
    size="lg"
  >
    <form id="role-form" class="role-form" novalidate @submit.prevent="submit">
      <div class="role-form__grid">
        <BaseInput
          v-model="values.roleName"
          label="Role name"
          placeholder="Support Analyst"
          required
          :error="errors.roleName"
        />
        <BaseInput
          :model-value="values.roleKey"
          label="Role key"
          :hint="isEdit ? 'The key cannot change once created.' : 'Lowercase, words joined with _'"
          :required="!isEdit"
          :error="errors.roleKey"
          :readonly="isEdit"
          @update:model-value="onKeyInput"
        />
        <BaseInput
          v-model="values.description"
          class="role-form__wide"
          label="Description"
          placeholder="What it lets people see, in plain words"
        />
        <BaseInput v-model="values.ownerTeam" label="Owner team" placeholder="Support" />
        <BaseInput
          v-model="values.approverEmail"
          label="Approver email"
          type="email"
          hint="Who decides whether someone may have this role."
          :error="errors.approverEmail"
        />
      </div>

      <section class="role-form__permissions">
        <h3 class="role-form__section-title">Permissions</h3>
        <PermissionPicker v-model="permissions" :domains="catalog.sortedDomains" />
      </section>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="role-form" :loading="pending">
        {{ isEdit ? 'Save changes' : 'Create role' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.role-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.role-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.role-form__wide {
  grid-column: 1 / -1;
}

.role-form__permissions {
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.role-form__section-title {
  margin-bottom: var(--space-3);
  font-size: var(--text-md);
}

@media (max-width: 560px) {
  .role-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
