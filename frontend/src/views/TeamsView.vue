<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamCard from '@/components/teams/TeamCard.vue'
import TeamFormModal from '@/components/teams/TeamFormModal.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import type { Team } from '@/types/access-control'

const teamsStore = useTeamsStore()
const session = useSessionStore()

const formOpen = ref(false)
const editingTeam = ref<Team | null>(null)

function openCreate(): void {
  editingTeam.value = null
  formOpen.value = true
}

function openEdit(team: Team): void {
  editingTeam.value = team
  formOpen.value = true
}

const toggleTarget = ref<Team | null>(null)
const toggleConfirmOpen = computed({
  get: () => toggleTarget.value !== null,
  set: (open) => {
    if (!open) toggleTarget.value = null
  },
})

const { run: toggleActive, pending: toggling } = useAsyncAction(
  async () => {
    const team = toggleTarget.value
    if (!team) return
    await teamsStore.update(team.teamId, { isActive: !team.isActive })
    toggleTarget.value = null
  },
  { successMessage: 'Team updated.' },
)
</script>

<template>
  <div>
    <PageHeader
      title="Teams"
      subtitle="Each team manages its own groups. Team admins add and remove people; global admins manage teams, roles and permissions."
    >
      <template v-if="session.isGlobalAdmin" #actions>
        <BaseButton @click="openCreate">+ New team</BaseButton>
      </template>
    </PageHeader>

    <div v-if="teamsStore.sorted.length" class="teams-grid">
      <TeamCard
        v-for="team in teamsStore.sorted"
        :key="team.teamId"
        :team="team"
        @edit="openEdit"
        @toggle-active="toggleTarget = $event"
      />
    </div>
    <EmptyState
      v-else
      title="No teams yet"
      message="Create a team, then give it admins and groups."
    >
      <BaseButton v-if="session.isGlobalAdmin" @click="openCreate">+ New team</BaseButton>
    </EmptyState>

    <TeamFormModal v-model:open="formOpen" :team="editingTeam" />
    <ConfirmDialog
      v-model:open="toggleConfirmOpen"
      :title="toggleTarget?.isActive ? 'Retire team?' : 'Reactivate team?'"
      :message="
        toggleTarget?.isActive
          ? `Everyone who gets access through ${toggleTarget?.teamName}'s groups loses it within 5 minutes, and its admins can no longer manage them. Nothing is deleted.`
          : `${toggleTarget?.teamName}'s groups give access again.`
      "
      :confirm-label="toggleTarget?.isActive ? 'Retire' : 'Reactivate'"
      :variant="toggleTarget?.isActive ? 'danger' : 'primary'"
      :loading="toggling"
      @confirm="toggleActive"
    />
  </div>
</template>

<style scoped>
.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-5);
}
</style>
