<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { appConfig } from '@/config'
import { RouteName } from '@/router/route-names'
import { useAccessStore } from '@/stores/access'
import { useCatalogStore } from '@/stores/catalog'
import { useRolesStore } from '@/stores/roles'
import type { Role } from '@/types/access-control'

const catalog = useCatalogStore()
const rolesStore = useRolesStore()
const access = useAccessStore()

/** Active roles that grant each domain key. */
const rolesByDomain = computed(() => {
  const map = new Map<string, Role[]>()
  for (const p of rolesStore.permissions) {
    if (p.resourceType !== 'domain') continue
    const role = rolesStore.byId.get(p.roleId)
    if (!role?.isActive) continue
    const list = map.get(p.resourceKey)
    if (list) list.push(role)
    else map.set(p.resourceKey, [role])
  }
  return map
})

/** Permission rows pointing at domains the catalogue doesn't have. */
const orphanedPermissions = computed(() =>
  rolesStore.permissions
    .filter((p) => p.resourceType === 'domain' && !catalog.isKnown(p))
    .map((p) => ({ ...p, role: rolesStore.byId.get(p.roleId) })),
)

const { run: refresh, pending: refreshing } = useAsyncAction(() => catalog.fetchAll(), {
  successMessage: 'Domains refreshed.',
})
</script>

<template>
  <div class="domains">
    <PageHeader
      title="Domains"
      subtitle="A domain is a folder of metrics in the analytics MCP repo. New folders show up here automatically — then you can grant them through a role."
    >
      <template #actions>
        <BaseButton variant="secondary" :loading="refreshing" @click="refresh()"
          >Refresh</BaseButton
        >
        <BaseButton :to="{ name: RouteName.Roles }">Grant via a role →</BaseButton>
      </template>
    </PageHeader>

    <BaseCard v-if="orphanedPermissions.length" title="Permissions for unknown domains">
      <p class="orphans__intro">
        These role permissions name a domain that isn't in the metrics catalogue, so they grant
        nothing. The folder may have been renamed or removed. Edit the role to fix or remove them.
      </p>
      <ul class="orphans">
        <li v-for="p in orphanedPermissions" :key="p.rolePermissionId">
          <BaseBadge variant="danger" dot>{{ p.resourceKey }}</BaseBadge>
          on <strong>{{ p.role?.roleName ?? 'unknown role' }}</strong>
        </li>
      </ul>
    </BaseCard>

    <BaseCard
      title="Available domains"
      :subtitle="`${catalog.domains.length} in the catalogue`"
      :padded="false"
    >
      <div v-if="catalog.sortedDomains.length" class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Domain</th>
              <th scope="col">Metrics</th>
              <th scope="col">Agent</th>
              <th scope="col">Granted by roles</th>
              <th scope="col">People who can see it</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="domain in catalog.sortedDomains" :key="domain.key">
              <td>
                <strong>{{ domain.label }}</strong>
                <code class="domains__key">{{ domain.key }}</code>
              </td>
              <td>
                {{ domain.metricCount }}
                <BaseBadge v-if="domain.metricCount === 0" variant="warning" dot>
                  No metrics yet
                </BaseBadge>
              </td>
              <td>
                <BaseBadge v-if="domain.loadedByAgent" variant="success" dot>Loaded</BaseBadge>
                <BaseBadge
                  v-else
                  variant="warning"
                  dot
                  title="Add the folder to metrics_dirs in agents/roller_analyst.yaml"
                >
                  Not in metrics_dirs
                </BaseBadge>
              </td>
              <td>
                <span v-if="rolesByDomain.get(domain.key)?.length" class="domains__roles">
                  {{
                    rolesByDomain
                      .get(domain.key)!
                      .map((r) => r.roleName)
                      .join(', ')
                  }}
                </span>
                <span v-else class="text-muted">No role grants it yet</span>
              </td>
              <td>{{ access.userCountWithDomain(domain.key) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState
        v-else
        title="No domains found"
        message="The metrics catalogue is empty. Check the backend can read semantic/metrics/."
      />
    </BaseCard>

    <BaseCard
      title="Adding a new domain"
      subtitle="Done in the bapps-edp-analytics-mcp repo, not here"
    >
      <ol class="steps">
        <li>
          Create <code>semantic/metrics/&lt;domain&gt;/</code> with a <code>_domain.yaml</code> and
          the metric files. The folder name is the domain key — lowercase, words joined with
          <code>_</code>.
        </li>
        <li>
          Add the folder to <code>metrics_dirs</code> in <code>agents/roller_analyst.yaml</code>,
          then re-run <code>semantic_refresh.py</code>.
        </li>
        <li>
          Add the key to <code>valid_resources</code> in
          <code>semantic/access_control/validate.sql</code>.
        </li>
        <li>
          Ask a GCP admin to give the agent's service account read access to the new dataset (the
          second gate — see the access-control guide, section 5.4).
        </li>
        <li>
          <template v-if="appConfig.apiMode === 'mock'">
            Run <code>npm run sync:domains</code> in this UI and reload.
          </template>
          <template v-else>Click <strong>Refresh</strong> above.</template>
          The domain appears in the list and in every role's permission picker.
        </li>
        <li>
          Go to <RouterLink :to="{ name: RouteName.Roles }">Roles & permissions</RouterLink>, tick
          the domain on a role (or create one), and grant that role to people.
        </li>
      </ol>
      <p class="steps__note">
        Domains can't be typed in here on purpose: the match is exact, so a key without a metrics
        folder behind it would silently grant nothing.
      </p>
    </BaseCard>
  </div>
</template>

<style scoped>
.domains {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.domains :deep(.page-header) {
  margin-bottom: 0;
}

.domains__key {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.domains__roles {
  white-space: nowrap;
}

.orphans__intro {
  margin-bottom: var(--space-3);
}

.orphans {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding-left: var(--space-5);
}

.steps__note {
  margin-top: var(--space-4);
  color: var(--color-text-muted);
}
</style>
