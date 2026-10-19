<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import EditUserModal from '@/components/users/EditUserModal.vue'
import GrantRoleModal from '@/components/users/GrantRoleModal.vue'
import UserGrantsTable from '@/components/users/UserGrantsTable.vue'
import UserStatusBadge from '@/components/users/UserStatusBadge.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { RouteName } from '@/router/route-names'
import { useAccessStore } from '@/stores/access'
import { useCatalogStore } from '@/stores/catalog'
import { useGrantsStore } from '@/stores/grants'
import { useRolesStore } from '@/stores/roles'
import { useUsersStore } from '@/stores/users'
import { isGrantOpen } from '@/domain/grants'
import type { UserRole } from '@/types/access-control'
import { formatDate } from '@/utils/date'
import { fullName } from '@/utils/user'

const { userId } = defineProps<{ userId: string }>()

const usersStore = useUsersStore()
const rolesStore = useRolesStore()
const grantsStore = useGrantsStore()
const access = useAccessStore()
const catalog = useCatalogStore()

const user = computed(() => usersStore.byId.get(userId))
const summary = computed(() => access.accessFor(userId))

const showHistory = ref(false)
const allGrants = computed(() =>
  [...grantsStore.grantsFor(userId)].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt)),
)
const visibleGrants = computed(() =>
  showHistory.value ? allGrants.value : allGrants.value.filter((g) => isGrantOpen(g)),
)
const closedGrantCount = computed(() => allGrants.value.length - visibleGrants.value.length)

function roleNames(keys: readonly string[] | undefined): string {
  return (keys ?? [])
    .map((key) => rolesStore.roles.find((r) => r.roleKey === key)?.roleName ?? key)
    .join(', ')
}

// ── Modals & actions ──────────────────────────────────────────────────────

const editOpen = ref(false)
const grantOpen = ref(false)
const statusConfirmOpen = ref(false)
const revokeTarget = ref<UserRole | null>(null)
const revokeConfirmOpen = computed({
  get: () => revokeTarget.value !== null,
  set: (open) => {
    if (!open) revokeTarget.value = null
  },
})

const { run: toggleActive, pending: togglingActive } = useAsyncAction(
  async () => {
    if (!user.value) return
    await usersStore.setActive(userId, !user.value.isActive)
    statusConfirmOpen.value = false
  },
  { successMessage: () => (user.value?.isActive ? 'User reactivated.' : 'User deactivated.') },
)

const { run: revoke, pending: revoking } = useAsyncAction(
  async () => {
    if (!revokeTarget.value) return
    await grantsStore.revoke(revokeTarget.value.userRoleId)
    revokeTarget.value = null
  },
  { successMessage: 'Access revoked.' },
)

const revokeMessage = computed(() => {
  const role = revokeTarget.value && rolesStore.byId.get(revokeTarget.value.roleId)
  return `${user.value?.email} will lose the ${role?.roleName ?? ''} role within 5 minutes. The grant stays in the history.`
})
</script>

<template>
  <div v-if="user" class="user-detail">
    <PageHeader :title="fullName(user)">
      <template #eyebrow>
        <RouterLink :to="{ name: RouteName.Users }" class="back">← All users</RouterLink>
      </template>
      <template #actions>
        <BaseButton variant="secondary" @click="editOpen = true">Edit details</BaseButton>
        <BaseButton
          :variant="user.isActive ? 'danger' : 'secondary'"
          @click="statusConfirmOpen = true"
        >
          {{ user.isActive ? 'Deactivate' : 'Reactivate' }}
        </BaseButton>
        <BaseButton :disabled="!user.isActive" @click="grantOpen = true">+ Grant role</BaseButton>
      </template>
    </PageHeader>

    <div class="user-detail__grid">
      <BaseCard class="profile">
        <div class="profile__head">
          <UserAvatar :user="user" size="lg" />
          <div>
            <p class="profile__email">{{ user.email }}</p>
            <UserStatusBadge :active="user.isActive" />
          </div>
        </div>
        <dl class="profile__meta">
          <div>
            <dt>Department</dt>
            <dd>{{ user.department ?? '—' }}</dd>
          </div>
          <div>
            <dt>Entra object ID</dt>
            <dd>{{ user.entraObjectId ?? 'Not linked — matched by email' }}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{{ formatDate(user.createdAt) }} by {{ user.createdBy }}</dd>
          </div>
          <div v-if="user.updatedAt">
            <dt>Last changed</dt>
            <dd>{{ formatDate(user.updatedAt) }} by {{ user.updatedBy }}</dd>
          </div>
        </dl>
      </BaseCard>

      <BaseCard title="What they can see now" subtitle="Same rules as the effective_access view">
        <p v-if="!user.isActive" class="notice">
          This user is inactive, so they have no access, whatever roles they hold.
        </p>
        <ul class="access-list">
          <li
            v-for="resource in catalog.allResources"
            :key="resource.key"
            class="access-list__item"
            :class="{ 'is-granted': summary.via[resource.key] }"
          >
            <span class="access-list__icon" aria-hidden="true">
              {{ summary.via[resource.key] ? '✓' : '–' }}
            </span>
            <span class="access-list__text">
              <strong>{{ resource.label }}</strong>
              <BaseBadge v-if="resource.type === 'tier'" variant="muted">tier</BaseBadge>
              <small v-if="summary.via[resource.key]"
                >via {{ roleNames(summary.via[resource.key]) }}</small
              >
              <small v-else>No access</small>
            </span>
          </li>
        </ul>
      </BaseCard>
    </div>

    <BaseCard
      title="Roles & grants"
      :subtitle="showHistory ? 'All grants, newest first' : 'Active and scheduled grants'"
      :padded="false"
    >
      <template #actions>
        <BaseButton variant="ghost" size="sm" @click="showHistory = !showHistory">
          {{ showHistory ? 'Hide history' : `Show history (${closedGrantCount})` }}
        </BaseButton>
      </template>
      <UserGrantsTable
        v-if="visibleGrants.length"
        :grants="visibleGrants"
        @revoke="revokeTarget = $event"
      />
      <EmptyState
        v-else
        title="No current roles"
        message="This person can't see any analytics data until they're granted a role."
      >
        <BaseButton v-if="user.isActive" @click="grantOpen = true">+ Grant role</BaseButton>
      </EmptyState>
    </BaseCard>

    <EditUserModal v-model:open="editOpen" :user="user" />
    <GrantRoleModal v-model:open="grantOpen" :user="user" />
    <ConfirmDialog
      v-model:open="statusConfirmOpen"
      :title="user.isActive ? 'Deactivate user?' : 'Reactivate user?'"
      :message="
        user.isActive
          ? `${user.email} will lose ALL access within 5 minutes. Their grants are kept and come back if you reactivate them.`
          : `${user.email} will regain access from any grants that are still valid.`
      "
      :confirm-label="user.isActive ? 'Deactivate' : 'Reactivate'"
      :variant="user.isActive ? 'danger' : 'primary'"
      :loading="togglingActive"
      @confirm="toggleActive"
    />
    <ConfirmDialog
      v-model:open="revokeConfirmOpen"
      title="Revoke access?"
      :message="revokeMessage"
      confirm-label="Revoke"
      variant="danger"
      :loading="revoking"
      @confirm="revoke"
    />
  </div>

  <EmptyState
    v-else
    title="User not found"
    message="They may have been removed, or the link is wrong."
  >
    <BaseButton :to="{ name: RouteName.Users }" variant="secondary">Back to users</BaseButton>
  </EmptyState>
</template>

<style scoped>
.user-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.user-detail :deep(.page-header) {
  margin-bottom: 0;
}

.back {
  display: inline-block;
  margin-bottom: var(--space-2);
  font-weight: 700;
}

.user-detail__grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr);
  gap: var(--space-5);
  align-items: start;
}

.profile__head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.profile__email {
  margin-bottom: var(--space-1);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.profile__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
}

.profile__meta dt {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.profile__meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
}

.access-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.access-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.access-list__item.is-granted {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-text);
}

.access-list__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-mark-empty);
  font-size: var(--text-xs);
  font-weight: 700;
}

.is-granted .access-list__icon {
  background: var(--color-accent);
  color: var(--color-text-inverse);
}

.access-list__text {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--space-2);
}

.access-list__text small {
  flex-basis: 100%;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .user-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
