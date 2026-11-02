import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { Me } from '@/types/access-control'

/**
 * The signed-in admin. Used only to hide buttons they can't use; the backend
 * makes the real decision on every change.
 */
export const useSessionStore = defineStore('session', () => {
  const api = useApi()

  const me = ref<Me | null>(null)

  const isGlobalAdmin = computed(() => me.value?.isGlobalAdmin ?? false)
  const adminTeamIds = computed(() => new Set(me.value?.adminTeamIds ?? []))

  function canManageTeam(teamId: string | null | undefined): boolean {
    return isGlobalAdmin.value || (Boolean(teamId) && adminTeamIds.value.has(teamId!))
  }

  async function fetchMe(): Promise<void> {
    me.value = await api.getMe()
  }

  return { me, isGlobalAdmin, adminTeamIds, canManageTeam, fetchMe }
})
