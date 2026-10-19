import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { GrantRoleInput, UserRole } from '@/types/access-control'
import { isExpiringSoon, isGrantActive } from '@/domain/grants'

export const useGrantsStore = defineStore('grants', () => {
  const api = useApi()

  const grants = ref<UserRole[]>([])

  const byUser = computed(() => {
    const map = new Map<string, UserRole[]>()
    for (const g of grants.value) {
      const list = map.get(g.userId)
      if (list) list.push(g)
      else map.set(g.userId, [g])
    }
    return map
  })

  const activeGrants = computed(() => grants.value.filter((g) => isGrantActive(g)))
  const expiringSoon = computed(() =>
    grants.value
      .filter((g) => isExpiringSoon(g))
      .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '')),
  )

  function grantsFor(userId: string): UserRole[] {
    return byUser.value.get(userId) ?? []
  }

  function activeHolderCount(roleId: string): number {
    return activeGrants.value.filter((g) => g.roleId === roleId).length
  }

  async function fetchAll(): Promise<void> {
    grants.value = await api.listGrants()
  }

  async function grant(input: GrantRoleInput): Promise<UserRole> {
    const created = await api.grantRole(input)
    grants.value.push(created)
    return created
  }

  async function revoke(userRoleId: string): Promise<UserRole> {
    const updated = await api.revokeGrant(userRoleId)
    const index = grants.value.findIndex((g) => g.userRoleId === userRoleId)
    if (index >= 0) grants.value[index] = updated
    return updated
  }

  return {
    grants,
    byUser,
    activeGrants,
    expiringSoon,
    grantsFor,
    activeHolderCount,
    fetchAll,
    grant,
    revoke,
  }
})
