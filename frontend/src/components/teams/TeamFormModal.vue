<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useTeamsStore } from '@/stores/teams'
import type { Team } from '@/types/access-control'
import { toRoleKey, validateKey, validateRequired } from '@/domain/validation'

const open = defineModel<boolean>('open', { required: true })
/** Pass a team to edit it; omit to create one. */
const { team = null } = defineProps<{ team?: Team | null }>()

const teamsStore = useTeamsStore()
const isEdit = computed(() => team !== null)

const values = reactive({ teamName: '', teamKey: '', description: '' })
const keyEdited = ref(false)
const submitted = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  values.teamName = team?.teamName ?? ''
  values.teamKey = team?.teamKey ?? ''
  values.description = team?.description ?? ''
  keyEdited.value = false
  submitted.value = false
})

watch(
  () => values.teamName,
  (name) => {
    if (!isEdit.value && !keyEdited.value) values.teamKey = toRoleKey(name)
  },
)

function onKeyInput(value: string): void {
  keyEdited.value = true
  values.teamKey = value
}

const allErrors = computed(() => ({
  teamName: validateRequired(values.teamName, 'Team name'),
  teamKey: isEdit.value ? null : validateKey(values.teamKey, 'Team key', 'customer_success'),
}))
const errors = computed(() =>
  submitted.value ? allErrors.value : { teamName: null, teamKey: null },
)

const { run: save, pending } = useAsyncAction(
  () => {
    const details = {
      teamName: values.teamName.trim(),
      description: values.description.trim() || null,
    }
    if (team) return teamsStore.update(team.teamId, details)
    return teamsStore.create({ ...details, teamKey: values.teamKey })
  },
  { successMessage: () => (isEdit.value ? 'Team updated.' : 'Team created.') },
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
    :title="isEdit ? `Edit ${team?.teamName}` : 'New team'"
    description="A team manages its own groups. Add team admins after creating it."
  >
    <form id="team-form" class="team-form" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="values.teamName"
        label="Team name"
        placeholder="Customer Success"
        required
        :error="errors.teamName"
      />
      <BaseInput
        :model-value="values.teamKey"
        label="Team key"
        :hint="isEdit ? 'The key cannot change once created.' : 'Lowercase, words joined with _'"
        :required="!isEdit"
        :readonly="isEdit"
        :error="errors.teamKey"
        @update:model-value="onKeyInput"
      />
      <BaseInput v-model="values.description" label="Description" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="team-form" :loading="pending">
        {{ isEdit ? 'Save changes' : 'Create team' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.team-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
