<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import type { Group } from '@/types/access-control'
import { toRoleKey, validateKey, validateRequired } from '@/domain/validation'

const open = defineModel<boolean>('open', { required: true })
/** Pass a group to edit it; omit to create one. `teamId` preselects the team. */
const { group = null, teamId = null } = defineProps<{
  group?: Group | null
  teamId?: string | null
}>()
const emit = defineEmits<{ saved: [group: Group] }>()

const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()
const teamsStore = useTeamsStore()
const session = useSessionStore()
const isEdit = computed(() => group !== null)

const values = reactive({
  groupName: '',
  groupKey: '',
  teamId: '',
  description: '',
  entraGroupId: '',
})
const roleIds = ref<string[]>([])
const keyEdited = ref(false)
const submitted = ref(false)

const teamOptions = computed(() =>
  teamsStore.activeTeams
    .filter((t) => session.canManageTeam(t.teamId))
    .map((t) => ({ value: t.teamId, label: t.teamName })),
)

/** Team admins can give their groups only their own team's roles. */
const roleChoices = computed(() =>
  rolesStore.activeRoles.filter(
    (r) => session.isGlobalAdmin || (values.teamId && r.teamId === values.teamId),
  ),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  values.groupName = group?.groupName ?? ''
  values.groupKey = group?.groupKey ?? ''
  values.teamId =
    group?.teamId ?? teamId ?? (teamOptions.value.length === 1 ? teamOptions.value[0]!.value : '')
  values.description = group?.description ?? ''
  values.entraGroupId = group?.entraGroupId ?? ''
  roleIds.value = []
  keyEdited.value = false
  submitted.value = false
})

// Suggest a key from the name until the admin types their own.
watch(
  () => values.groupName,
  (name) => {
    if (!isEdit.value && !keyEdited.value) values.groupKey = toRoleKey(name)
  },
)

function onKeyInput(value: string): void {
  keyEdited.value = true
  values.groupKey = value
}

function toggleRole(roleId: string): void {
  roleIds.value = roleIds.value.includes(roleId)
    ? roleIds.value.filter((id) => id !== roleId)
    : [...roleIds.value, roleId]
}

const allErrors = computed(() => ({
  groupName: validateRequired(values.groupName, 'Group name'),
  groupKey: isEdit.value ? null : validateKey(values.groupKey, 'Group key', 'support_analysts'),
  teamId: values.teamId ? null : 'Choose a team.',
}))
const errors = computed(() =>
  submitted.value ? allErrors.value : { groupName: null, groupKey: null, teamId: null },
)

const { run: save, pending } = useAsyncAction(
  () => {
    const details = {
      groupName: values.groupName.trim(),
      description: values.description.trim() || null,
      entraGroupId: values.entraGroupId.trim() || null,
    }
    if (group) return groupsStore.update(group.groupId, details)
    return groupsStore.create(
      { ...details, groupKey: values.groupKey, teamId: values.teamId },
      roleIds.value,
    )
  },
  { successMessage: () => (isEdit.value ? 'Group updated.' : 'Group created.') },
)

async function submit(): Promise<void> {
  submitted.value = true
  if (Object.values(allErrors.value).some(Boolean)) return
  const saved = await save()
  if (saved) {
    emit('saved', saved)
    open.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="isEdit ? `Edit ${group?.groupName}` : 'New group'"
    description="A group is a set of people who get the same roles, e.g. Support Analysts AU."
    size="lg"
  >
    <form id="group-form" class="group-form" novalidate @submit.prevent="submit">
      <div class="group-form__grid">
        <BaseInput
          v-model="values.groupName"
          label="Group name"
          placeholder="Support Analysts"
          required
          :error="errors.groupName"
        />
        <BaseInput
          :model-value="values.groupKey"
          label="Group key"
          :hint="isEdit ? 'The key cannot change once created.' : 'Lowercase, words joined with _'"
          :required="!isEdit"
          :readonly="isEdit"
          :error="errors.groupKey"
          @update:model-value="onKeyInput"
        />
        <BaseSelect
          v-if="!isEdit"
          v-model="values.teamId"
          label="Team"
          placeholder="Choose a team…"
          :options="teamOptions"
          hint="The team that manages this group."
          required
          :error="errors.teamId"
        />
        <BaseInput
          v-else
          :model-value="teamsStore.teamName(group?.teamId)"
          label="Team"
          hint="A group can't move to another team."
          readonly
        />
        <BaseInput
          v-model="values.entraGroupId"
          label="Entra group ID"
          hint="Optional. For syncing members from Entra later."
        />
        <BaseInput
          v-model="values.description"
          class="group-form__wide"
          label="Description"
          placeholder="Who should be in it, in plain words"
        />
      </div>

      <section v-if="!isEdit" class="group-form__roles">
        <h3 class="group-form__section-title">
          Roles <span class="text-muted">(optional — you can add them later)</span>
        </h3>
        <p v-if="!roleChoices.length" class="text-muted">
          {{
            values.teamId
              ? 'This team owns no roles yet. Ask a global admin.'
              : 'Choose a team first.'
          }}
        </p>
        <div class="group-form__role-list">
          <button
            v-for="role in roleChoices"
            :key="role.roleId"
            type="button"
            class="role-toggle"
            :class="{ 'is-selected': roleIds.includes(role.roleId) }"
            :aria-pressed="roleIds.includes(role.roleId)"
            @click="toggleRole(role.roleId)"
          >
            <strong>{{ role.roleName }}</strong>
            <small class="text-muted">{{ role.description }}</small>
          </button>
        </div>
      </section>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="group-form" :loading="pending">
        {{ isEdit ? 'Save changes' : 'Create group' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.group-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.group-form__wide {
  grid-column: 1 / -1;
}

.group-form__roles {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.group-form__section-title {
  font-size: var(--text-md);
}

.group-form__role-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
}

.role-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
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

@media (max-width: 560px) {
  .group-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
