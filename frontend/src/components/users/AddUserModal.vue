<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import GrantDetailsFields from '@/components/access/GrantDetailsFields.vue'
import UserFormFields from './UserFormFields.vue'
import { useUserForm } from '@/composables/useUserForm'
import { useGrantForm } from '@/composables/useGrantForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useUsersStore } from '@/stores/users'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import { useNotificationsStore } from '@/stores/notifications'
import { appConfig } from '@/config'
import type { User } from '@/types/access-control'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [user: User] }>()

const usersStore = useUsersStore()
const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()
const teamsStore = useTeamsStore()
const session = useSessionStore()
const notifications = useNotificationsStore()

const userForm = useUserForm()
const grantForm = useGrantForm(() => userForm.values.email, appConfig.actorEmail)
const selectedGroupIds = ref<string[]>([])

const addingToGroups = computed(() => selectedGroupIds.value.length > 0)

/** Groups this admin can add people to. */
const groupChoices = computed(() =>
  groupsStore.activeGroups.filter((g) => session.canManageTeam(g.teamId)),
)

function roleNames(groupId: string): string {
  return groupsStore
    .rolesOf(groupId)
    .map((gr) => rolesStore.byId.get(gr.roleId)?.roleName ?? '')
    .filter(Boolean)
    .join(', ')
}

watch(open, (isOpen) => {
  if (!isOpen) return
  userForm.reset()
  grantForm.reset()
  selectedGroupIds.value = []
})

function toggleGroup(groupId: string): void {
  selectedGroupIds.value = selectedGroupIds.value.includes(groupId)
    ? selectedGroupIds.value.filter((id) => id !== groupId)
    : [...selectedGroupIds.value, groupId]
}

const { run: save, pending } = useAsyncAction(async () => {
  const user = await usersStore.create(userForm.toInput())
  const timing = addingToGroups.value ? grantForm.toTiming() : null

  // Added one group at a time so a failure is reported per group.
  const failed: string[] = []
  for (const groupId of timing ? selectedGroupIds.value : []) {
    try {
      await groupsStore.addMember(groupId, {
        userId: user.userId,
        addedAt: timing!.grantedAt,
        expiresAt: timing!.expiresAt,
        approvedBy: timing!.grantedBy,
        reason: timing!.reason,
      })
    } catch {
      failed.push(groupsStore.byId.get(groupId)?.groupName ?? groupId)
    }
  }

  if (failed.length) {
    notifications.error(`User added, but adding to these groups failed: ${failed.join(', ')}`)
  } else notifications.success(`${user.email} added.`)
  return user
})

async function submit(): Promise<void> {
  const userValid = userForm.validate()
  const grantValid = !addingToGroups.value || grantForm.validate()
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

      <section
        v-if="groupChoices.length"
        class="add-user__groups"
        aria-labelledby="add-user-groups-title"
      >
        <h3 id="add-user-groups-title" class="add-user__section-title">
          Add to groups <span class="text-muted">(optional)</span>
        </h3>
        <div class="add-user__group-list">
          <button
            v-for="group in groupChoices"
            :key="group.groupId"
            type="button"
            class="group-toggle"
            :class="{ 'is-selected': selectedGroupIds.includes(group.groupId) }"
            :aria-pressed="selectedGroupIds.includes(group.groupId)"
            @click="toggleGroup(group.groupId)"
          >
            <strong>{{ group.groupName }}</strong>
            <small class="text-muted">{{ teamsStore.teamName(group.teamId) }}</small>
            <small>{{ roleNames(group.groupId) || 'No roles yet' }}</small>
          </button>
        </div>

        <GrantDetailsFields
          v-if="addingToGroups"
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
        {{ addingToGroups ? `Add user to ${selectedGroupIds.length} group(s)` : 'Add user' }}
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

.add-user__groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.add-user__section-title {
  font-size: var(--text-md);
}

.add-user__group-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
}

.group-toggle {
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

.group-toggle:hover {
  border-color: var(--color-accent);
}

.group-toggle.is-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}
</style>
