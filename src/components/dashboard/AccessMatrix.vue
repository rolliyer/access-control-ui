<script setup lang="ts">
import { useRouter } from 'vue-router'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { TIERS } from '@/domain/resources'
import { useCatalogStore } from '@/stores/catalog'
import { RouteName } from '@/router/route-names'
import { useAccessStore } from '@/stores/access'
import type { User } from '@/types/access-control'
import { fullName } from '@/utils/user'

/** Users × domains grid showing who can see what right now. */
defineProps<{ users: readonly User[] }>()

const router = useRouter()
const access = useAccessStore()
const catalog = useCatalogStore()

function via(userId: string, key: string): string {
  const roles = access.accessFor(userId).via[key]
  return roles?.length ? `Granted by: ${roles.join(', ')}` : 'No access'
}

function open(user: User): void {
  router.push({ name: RouteName.UserDetail, params: { userId: user.userId } })
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table matrix">
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th
            v-for="domain in catalog.domainResources"
            :key="domain.key"
            scope="col"
            class="matrix__col"
          >
            {{ domain.label }}
          </th>
          <th v-for="tier in TIERS" :key="tier.key" scope="col" class="matrix__col matrix__tier">
            {{ tier.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.userId"
          class="is-clickable"
          tabindex="0"
          :class="{ 'is-inactive': !user.isActive }"
          @click="open(user)"
          @keydown.enter="open(user)"
        >
          <th scope="row" class="matrix__person">
            <UserAvatar :user="user" size="sm" />
            <span>
              <strong>{{ fullName(user) }}</strong>
              <small>{{ user.isActive ? user.email : 'Inactive — no access' }}</small>
            </span>
          </th>
          <td
            v-for="resource in catalog.allResources"
            :key="resource.key"
            class="matrix__cell"
            :title="via(user.userId, resource.key)"
          >
            <span
              v-if="access.accessFor(user.userId).via[resource.key]"
              class="matrix__dot"
              :class="{ 'is-tier': resource.type === 'tier' }"
              role="img"
              :aria-label="`Can see ${resource.label}`"
            >
              ✓
            </span>
            <span v-else class="matrix__none" aria-label="No access">·</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.matrix__col {
  text-align: center !important;
}

.matrix__tier {
  background: var(--color-accent-subtle);
}

.matrix__person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 240px;
  font-weight: 400;
  text-align: left;
}

.matrix__person span {
  display: flex;
  flex-direction: column;
}

.matrix__person small {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.matrix__cell {
  text-align: center;
}

.matrix__dot {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-text-inverse);
  font-size: var(--text-xs);
  font-weight: 700;
}

.matrix__dot.is-tier {
  background: var(--color-accent-strong);
}

.matrix__none {
  color: var(--color-mark-empty);
  font-size: var(--text-lg);
}

.is-inactive .matrix__person {
  opacity: 0.6;
}
</style>
