import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  computeEffectiveAccess,
  EMPTY_ACCESS,
  summarizeByUser,
  type UserAccessSummary,
} from '@/domain/effective-access'
import { useCatalogStore } from './catalog'
import { useGrantsStore } from './grants'
import { useRolesStore } from './roles'
import { useUsersStore } from './users'

/**
 * Loads all access-control data and derives the `effective_access` view
 * from the users, roles and grants stores.
 */
export const useAccessStore = defineStore('access', () => {
  const usersStore = useUsersStore()
  const rolesStore = useRolesStore()
  const grantsStore = useGrantsStore()
  const catalogStore = useCatalogStore()

  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const effectiveAccess = computed(() =>
    computeEffectiveAccess({
      users: usersStore.users,
      roles: rolesStore.roles,
      permissions: rolesStore.permissions,
      grants: grantsStore.grants,
    }),
  )

  const summaryByUser = computed(() => summarizeByUser(effectiveAccess.value))

  function accessFor(userId: string): Readonly<UserAccessSummary> {
    return summaryByUser.value.get(userId) ?? EMPTY_ACCESS
  }

  /** Active users who can see the given domain right now. */
  function userCountWithDomain(domainKey: string): number {
    let count = 0
    for (const summary of summaryByUser.value.values()) {
      if (summary.domains.includes(domainKey)) count++
    }
    return count
  }

  async function loadAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        catalogStore.fetchAll(),
        usersStore.fetchAll(),
        rolesStore.fetchAll(),
        grantsStore.fetchAll(),
      ])
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Could not load access data.'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    loaded,
    error,
    effectiveAccess,
    summaryByUser,
    accessFor,
    userCountWithDomain,
    loadAll,
  }
})
