import type {
  EffectiveAccessRow,
  Group,
  GroupMember,
  GroupRole,
  Role,
  RolePermission,
  Team,
  User,
  UserRole,
} from '@/types/access-control'
import { isGrantActive, isMembershipActive } from './grants'

export interface AccessSources {
  users: readonly User[]
  roles: readonly Role[]
  permissions: readonly RolePermission[]
  grants: readonly UserRole[]
  teams: readonly Team[]
  groups: readonly Group[]
  groupMembers: readonly GroupMember[]
  groupRoles: readonly GroupRole[]
}

/** Summary of what one person can see right now, and through which roles. */
export interface UserAccessSummary {
  domains: string[]
  tiers: string[]
  roleKeys: string[]
  groupKeys: string[]
  /** resource key → role keys that grant it */
  via: Record<string, string[]>
}

/**
 * Client-side equivalent of the `effective_access` view: one row per
 * (person, role, resource) that is active right now. Access comes from
 * group membership, plus any legacy direct grant not yet moved to a group.
 */
export function computeEffectiveAccess(
  { users, roles, permissions, grants, teams, groups, groupMembers, groupRoles }: AccessSources,
  now: Date = new Date(),
): EffectiveAccessRow[] {
  const usersById = new Map(users.map((u) => [u.userId, u]))
  const rolesById = new Map(roles.map((r) => [r.roleId, r]))
  const permsByRole = groupBy(permissions, (p) => p.roleId)
  const activeTeamIds = new Set(teams.filter((t) => t.isActive).map((t) => t.teamId))
  const groupsById = new Map(groups.map((g) => [g.groupId, g]))
  const rolesByGroup = groupBy(
    groupRoles.filter((gr) => !gr.revokedAt),
    (gr) => gr.groupId,
  )

  const rows: EffectiveAccessRow[] = []
  function addRows(
    user: User | undefined,
    role: Role | undefined,
    groupKey: string | null,
    expiresAt: string | null,
  ): void {
    if (!user?.isActive || !role?.isActive) return
    for (const perm of permsByRole.get(role.roleId) ?? []) {
      rows.push({
        userId: user.userId,
        email: user.email,
        roleKey: role.roleKey,
        groupKey,
        resourceType: perm.resourceType,
        resourceKey: perm.resourceKey,
        expiresAt,
      })
    }
  }

  for (const member of groupMembers) {
    const group = groupsById.get(member.groupId)
    if (!group?.isActive || !activeTeamIds.has(group.teamId)) continue
    if (!isMembershipActive(member, now)) continue
    for (const groupRole of rolesByGroup.get(group.groupId) ?? []) {
      addRows(
        usersById.get(member.userId),
        rolesById.get(groupRole.roleId),
        group.groupKey,
        member.expiresAt,
      )
    }
  }

  for (const grant of grants) {
    if (!isGrantActive(grant, now)) continue
    addRows(usersById.get(grant.userId), rolesById.get(grant.roleId), null, grant.expiresAt)
  }
  return rows
}

export function summarizeByUser(
  rows: readonly EffectiveAccessRow[],
): Map<string, UserAccessSummary> {
  const result = new Map<string, UserAccessSummary>()
  for (const row of rows) {
    let summary = result.get(row.userId)
    if (!summary) {
      summary = { domains: [], tiers: [], roleKeys: [], groupKeys: [], via: {} }
      result.set(row.userId, summary)
    }
    const bucket = row.resourceType === 'domain' ? summary.domains : summary.tiers
    addUnique(bucket, row.resourceKey)
    addUnique(summary.roleKeys, row.roleKey)
    if (row.groupKey) addUnique(summary.groupKeys, row.groupKey)
    addUnique((summary.via[row.resourceKey] ??= []), row.roleKey)
  }
  return result
}

export const EMPTY_ACCESS: Readonly<UserAccessSummary> = Object.freeze({
  domains: [],
  tiers: [],
  roleKeys: [],
  groupKeys: [],
  via: {},
})

function addUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value)
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}
