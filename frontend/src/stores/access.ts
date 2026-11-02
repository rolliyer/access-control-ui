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
import { useGroupsStore } from './groups'
import { useRolesStore } from './roles'
import { useSessionStore } from './session'
import { useTeamsStore } from './teams'
import { useUsersStore } from './users'

/**
 * Loads all access-control data and derives the `effective_access` view
 * from the users, roles, teams, groups and legacy grants stores.
 */
export const useAccessStore = defineStore('access', () => {
  const usersStore = useUsersStore()
  const rolesStore = useRolesStore()
  const grantsStore = useGrantsStore()
  const catalogStore = useCatalogStore()
  const teamsStore = useTeamsStore()
  const groupsStore = useGroupsStore()
  const session = useSessionStore()

  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const effectiveAccess = computed(() =>
    computeEffectiveAccess({
      users: usersStore.users,
      roles: rolesStore.roles,
      permissions: rolesStore.permissions,
      grants: grantsStore.grants,
      teams: teamsStore.teams,
      groups: groupsStore.groups,
      groupMembers: groupsStore.members,
      groupRoles: groupsStore.groupRoles,
    }),
  )

  const summaryByUser = computed(() => summarizeByUser(effectiveAccess.value))

  function accessFor(userId: string): Readonly<UserAccessSummary> {
    return summaryByUser.value.get(userId) ?? EMPTY_ACCESS
  }

  /** Active people who hold the role right now, through any group or grant. */
  function holderCount(roleKey: string): number {
    let count = 0
    for (const summary of summaryByUser.value.values()) {
      if (summary.roleKeys.includes(roleKey)) count++
    }
    return count
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
        teamsStore.fetchAll(),
        groupsStore.fetchAll(),
        session.fetchMe(),
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
    holderCount,
    userCountWithDomain,
    loadAll,
  }
})
