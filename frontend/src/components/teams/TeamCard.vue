<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { RouteName } from '@/router/route-names'
import { useGroupsStore } from '@/stores/groups'
import { useRolesStore } from '@/stores/roles'
import { useSessionStore } from '@/stores/session'
import { useTeamsStore } from '@/stores/teams'
import type { Team, TeamAdmin } from '@/types/access-control'
import { validateEmail } from '@/domain/validation'

const { team } = defineProps<{ team: Team }>()
const emit = defineEmits<{ edit: [team: Team]; toggleActive: [team: Team] }>()

const teamsStore = useTeamsStore()
const groupsStore = useGroupsStore()
const rolesStore = useRolesStore()
const session = useSessionStore()

const admins = computed(() => teamsStore.adminsOf(team.teamId))
const groupCount = computed(
  () => groupsStore.groups.filter((g) => g.teamId === team.teamId && g.isActive).length,
)
const roleCount = computed(
  () => rolesStore.roles.filter((r) => r.teamId === team.teamId && r.isActive).length,
)

const newAdmin = ref('')
const adminError = ref<string | null>(null)

const { run: addAdmin, pending: adding } = useAsyncAction(
  async () => {
    await teamsStore.addAdmin(team.teamId, newAdmin.value)
    newAdmin.value = ''
  },
  { successMessage: 'Team admin added.' },
)

const { run: removeAdmin } = useAsyncAction(
  (admin: TeamAdmin) => teamsStore.removeAdmin(admin.teamAdminId),
  { successMessage: 'Team admin removed.' },
)

function submitAdmin(): void {
  adminError.value = validateEmail(newAdmin.value)
  if (!adminError.value) void addAdmin()
}
</script>

<template>
  <article class="team" :class="{ 'is-retired': !team.isActive }">
    <header class="team__header">
      <div>
        <h3 class="team__name">{{ team.teamName }}</h3>
        <code class="team__key">{{ team.teamKey }}</code>
      </div>
      <BaseBadge v-if="!team.isActive" variant="muted">Retired</BaseBadge>
      <BaseBadge v-else-if="session.canManageTeam(team.teamId) && !session.isGlobalAdmin">
        You manage this
      </BaseBadge>
    </header>

    <p class="team__description">{{ team.description ?? 'No description.' }}</p>

    <dl class="team__meta">
      <div>
        <dt>Groups</dt>
        <dd>
          <RouterLink :to="{ name: RouteName.Groups, query: { team: team.teamId } }">
            {{ groupCount }}
          </RouterLink>
        </dd>
      </div>
      <div>
        <dt>Roles owned</dt>
        <dd>{{ roleCount }}</dd>
      </div>
    </dl>

    <section class="team__admins">
      <span class="team__label">Team admins</span>
      <ul v-if="admins.length">
        <li v-for="admin in admins" :key="admin.teamAdminId">
          <span>{{ admin.email }}</span>
          <BaseButton
            v-if="session.isGlobalAdmin"
            variant="ghost"
            size="sm"
            @click="removeAdmin(admin)"
          >
            Remove
          </BaseButton>
        </li>
      </ul>
      <p v-else class="text-muted">No admins yet — only global admins can manage its groups.</p>

      <form
        v-if="session.isGlobalAdmin && team.isActive"
        class="team__add-admin"
        novalidate
        @submit.prevent="submitAdmin"
      >
        <BaseInput
          v-model="newAdmin"
          label="Add team admin"
          type="email"
          placeholder="name@rollerdigital.com"
          :error="adminError"
        />
        <BaseButton type="submit" variant="secondary" size="sm" :loading="adding">Add</BaseButton>
      </form>
    </section>

    <footer v-if="session.isGlobalAdmin" class="team__actions">
      <BaseButton variant="secondary" size="sm" @click="emit('edit', team)">Edit team</BaseButton>
      <BaseButton
        :variant="team.isActive ? 'ghost' : 'secondary'"
        size="sm"
        @click="emit('toggleActive', team)"
      >
        {{ team.isActive ? 'Retire' : 'Reactivate' }}
      </BaseButton>
    </footer>
  </article>
</template>

<style scoped>
.team {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.team.is-retired {
  opacity: 0.7;
}

.team__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.team__name {
  font-size: var(--text-lg);
}

.team__key {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.team__description {
  color: var(--color-text-muted);
}

.team__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.team__meta dt,
.team__label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.team__meta dd {
  margin: 0;
  font-weight: 700;
}

.team__admins {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.team__admins ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.team__admins li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  overflow-wrap: anywhere;
}

.team__add-admin {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.team__add-admin > :first-child {
  flex: 1;
}

.team__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
</style>
