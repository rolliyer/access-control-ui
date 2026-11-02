import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { UserRole } from '@/types/access-control'
import { isGrantOpen } from '@/domain/grants'

/**
 * Legacy direct grants (user → role). Access now goes through groups, so
 * these are only shown and revoked until they have been moved to groups.
 */
export const useGrantsStore = defineStore('grants', () => {
  const api = useApi()

  const grants = ref<UserRole[]>([])

  const openGrants = computed(() => grants.value.filter((g) => isGrantOpen(g)))

  function grantsFor(userId: string): UserRole[] {
    return grants.value.filter((g) => g.userId === userId)
  }

  async function fetchAll(): Promise<void> {
    grants.value = await api.listGrants()
  }

  async function revoke(userRoleId: string): Promise<UserRole> {
    const updated = await api.revokeGrant(userRoleId)
    const index = grants.value.findIndex((g) => g.userRoleId === userRoleId)
    if (index >= 0) grants.value[index] = updated
    return updated
  }

  return { grants, openGrants, grantsFor, fetchAll, revoke }
})
