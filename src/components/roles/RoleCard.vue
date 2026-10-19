<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ResourceChips from '@/components/access/ResourceChips.vue'
import type { Role, RolePermission } from '@/types/access-control'

const { role, permissions } = defineProps<{
  role: Role
  permissions: readonly RolePermission[]
  holderCount: number
}>()

const emit = defineEmits<{ edit: [role: Role]; toggleActive: [role: Role] }>()

const domains = computed(() =>
  permissions.filter((p) => p.resourceType === 'domain').map((p) => p.resourceKey),
)
const tiers = computed(() =>
  permissions.filter((p) => p.resourceType === 'tier').map((p) => p.resourceKey),
)
</script>

<template>
  <article class="role" :class="{ 'is-retired': !role.isActive }">
    <header class="role__header">
      <div>
        <h3 class="role__name">{{ role.roleName }}</h3>
        <code class="role__key">{{ role.roleKey }}</code>
      </div>
      <BaseBadge v-if="!role.isActive" variant="muted">Retired</BaseBadge>
    </header>

    <p class="role__description">{{ role.description ?? 'No description.' }}</p>

    <div class="role__section">
      <span class="role__label">Can see</span>
      <ResourceChips :domains :tiers empty-label="No permissions" />
    </div>

    <dl class="role__meta">
      <div>
        <dt>Holders</dt>
        <dd>{{ holderCount }}</dd>
      </div>
      <div>
        <dt>Owner team</dt>
        <dd>{{ role.ownerTeam ?? '—' }}</dd>
      </div>
      <div class="role__meta-wide">
        <dt>Approver</dt>
        <dd>{{ role.approverEmail ?? '—' }}</dd>
      </div>
    </dl>

    <footer class="role__actions">
      <BaseButton variant="secondary" size="sm" @click="emit('edit', role)">
        Edit role & permissions
      </BaseButton>
      <BaseButton
        :variant="role.isActive ? 'ghost' : 'secondary'"
        size="sm"
        @click="emit('toggleActive', role)"
      >
        {{ role.isActive ? 'Retire' : 'Reactivate' }}
      </BaseButton>
    </footer>
  </article>
</template>

<style scoped>
.role {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.role.is-retired {
  background: var(--color-surface-muted);
}

.role__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.role__name {
  font-size: var(--text-md);
}

.role__key {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.role__description {
  color: var(--color-text-muted);
}

.role__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.role__label,
.role__meta dt {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.role__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

.role__meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.role__meta-wide {
  grid-column: 1 / -1;
}

.role__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
</style>
