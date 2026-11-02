<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import GrantDetailsFields from '@/components/access/GrantDetailsFields.vue'
import GroupAccessPreview from './GroupAccessPreview.vue'
import { useGrantForm } from '@/composables/useGrantForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useGroupsStore } from '@/stores/groups'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import { useUsersStore } from '@/stores/users'
import { isMembershipOpen } from '@/domain/grants'
import { appConfig } from '@/config'
import type { Group, User } from '@/types/access-control'
import { fullName } from '@/utils/user'

/**
 * Adds a person to a group. Pass `user` to choose the group (from a person's
 * page), or `group` to choose the person (from a group's page).
 */
const open = defineModel<boolean>('open', { required: true })
const { user = null, group = null } = defineProps<{ user?: User | null; group?: Group | null }>()

const groupsStore = useGroupsStore()
const teamsStore = useTeamsStore()
const usersStore = useUsersStore()
const session = useSessionStore()

const chosenId = ref('')
const choiceError = ref<string | null>(null)

const targetUser = computed(() => user ?? usersStore.byId.get(chosenId.value) ?? null)
const targetGroup = computed(() => group ?? groupsStore.byId.get(chosenId.value) ?? null)

const form = useGrantForm(() => targetUser.value?.email ?? '', appConfig.actorEmail)

const groupOptions = computed(() => {
  const held = user ? groupsStore.openGroupIdsOf(user.userId) : new Set<string>()
  return groupsStore.activeGroups
    .filter((g) => session.canManageTeam(g.teamId))
    .map((g) => ({
      value: g.groupId,
      label: `${g.groupName} · ${teamsStore.teamName(g.teamId)}${held.has(g.groupId) ? ' (already in)' : ''}`,
      disabled: held.has(g.groupId),
    }))
})

const userOptions = computed(() => {
  const inGroup = new Set(
    group
      ? groupsStore
          .membersOf(group.groupId)
          .filter((m) => isMembershipOpen(m))
          .map((m) => m.userId)
      : [],
  )
  return usersStore.sorted
    .filter((u) => u.isActive)
    .map((u) => ({
      value: u.userId,
      label: `${fullName(u)} (${u.email})${inGroup.has(u.userId) ? ' — already in' : ''}`,
      disabled: inGroup.has(u.userId),
    }))
})

watch(open, (isOpen) => {
  if (!isOpen) return
  chosenId.value = ''
  choiceError.value = null
  form.reset()
})

const { run: add, pending } = useAsyncAction(
  () => {
    const timing = form.toTiming()
    return groupsStore.addMember(targetGroup.value!.groupId, {
      userId: targetUser.value!.userId,
      addedAt: timing.grantedAt,
      expiresAt: timing.expiresAt,
      approvedBy: timing.grantedBy,
      reason: timing.reason,
    })
  },
  { successMessage: 'Added to group.' },
)

async function submit(): Promise<void> {
  choiceError.value = chosenId.value ? null : user ? 'Choose a group.' : 'Choose a person.'
  const valid = form.validate()
  if (choiceError.value || !valid) return
  if (await add()) open.value = false
}

const description = computed(() =>
  user
    ? `Add ${user.email} to a group. They get the group's roles within 5 minutes.`
    : `Add someone to ${group?.groupName}. They get its roles within 5 minutes.`,
)
</script>

<template>
  <BaseModal v-model:open="open" title="Add to group" :description="description">
    <form id="add-member-form" class="add-member" novalidate @submit.prevent="submit">
      <BaseSelect
        v-if="user"
        v-model="chosenId"
        label="Group"
        placeholder="Choose a group…"
        :options="groupOptions"
        hint="Only groups of teams you manage are listed."
        required
        :error="choiceError"
      />
      <BaseSelect
        v-else
        v-model="chosenId"
        label="Person"
        placeholder="Choose a person…"
        :options="userOptions"
        hint="Not listed? Add them on the Users page first."
        required
        :error="choiceError"
      />
      <GroupAccessPreview v-if="targetGroup" :group="targetGroup" />
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
      <BaseButton type="submit" form="add-member-form" :loading="pending">Add to group</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.add-member {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
