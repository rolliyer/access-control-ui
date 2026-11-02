import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { CreateTeamInput, Team, TeamAdmin, UpdateTeamInput } from '@/types/access-control'

export const useTeamsStore = defineStore('teams', () => {
  const api = useApi()

  const teams = ref<Team[]>([])
  const admins = ref<TeamAdmin[]>([])

  const byId = computed(() => new Map(teams.value.map((t) => [t.teamId, t])))
  const sorted = computed(() =>
    [...teams.value].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.teamName.localeCompare(b.teamName),
    ),
  )
  const activeTeams = computed(() => sorted.value.filter((t) => t.isActive))

  function teamName(teamId: string | null | undefined): string {
    return (teamId && byId.value.get(teamId)?.teamName) || '—'
  }

  /** Current (not removed) admins of a team. */
  function adminsOf(teamId: string): TeamAdmin[] {
    return admins.value.filter((a) => a.teamId === teamId && !a.removedAt)
  }

  async function fetchAll(): Promise<void> {
    const [teamRows, adminRows] = await Promise.all([api.listTeams(), api.listTeamAdmins()])
    teams.value = teamRows
    admins.value = adminRows
  }

  async function create(input: CreateTeamInput): Promise<Team> {
    const team = await api.createTeam(input)
    teams.value.push(team)
    return team
  }

  async function update(teamId: string, patch: UpdateTeamInput): Promise<Team> {
    const updated = await api.updateTeam(teamId, patch)
    replace(teams.value, (t) => t.teamId === teamId, updated)
    return updated
  }

  async function addAdmin(teamId: string, email: string): Promise<TeamAdmin> {
    const admin = await api.addTeamAdmin(teamId, email)
    admins.value.push(admin)
    return admin
  }

  async function removeAdmin(teamAdminId: string): Promise<TeamAdmin> {
    const updated = await api.removeTeamAdmin(teamAdminId)
    replace(admins.value, (a) => a.teamAdminId === teamAdminId, updated)
    return updated
  }

  return {
    teams,
    admins,
    byId,
    sorted,
    activeTeams,
    teamName,
    adminsOf,
    fetchAll,
    create,
    update,
    addAdmin,
    removeAdmin,
  }
})

function replace<T>(list: T[], match: (item: T) => boolean, value: T): void {
  const index = list.findIndex(match)
  if (index >= 0) list[index] = value
}
