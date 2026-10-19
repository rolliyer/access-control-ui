import type {
  EffectiveAccessRow,
  Role,
  RolePermission,
  User,
  UserRole,
} from '@/types/access-control'
import { isGrantActive } from './grants'

export interface AccessSources {
  users: readonly User[]
  roles: readonly Role[]
  permissions: readonly RolePermission[]
  grants: readonly UserRole[]
}

/** Summary of what one person can see right now, and through which roles. */
export interface UserAccessSummary {
  domains: string[]
  tiers: string[]
  roleKeys: string[]
  /** resource key → role keys that grant it */
  via: Record<string, string[]>
}

/**
 * Client-side equivalent of the `effective_access` view: one row per
 * (person, role, resource) that is active right now.
 */
export function computeEffectiveAccess(
  { users, roles, permissions, grants }: AccessSources,
  now: Date = new Date(),
): EffectiveAccessRow[] {
  const usersById = new Map(users.map((u) => [u.userId, u]))
  const rolesById = new Map(roles.map((r) => [r.roleId, r]))
  const permsByRole = groupBy(permissions, (p) => p.roleId)

  const rows: EffectiveAccessRow[] = []
  for (const grant of grants) {
    const user = usersById.get(grant.userId)
    const role = rolesById.get(grant.roleId)
    if (!user?.isActive || !role?.isActive || !isGrantActive(grant, now)) continue

    for (const perm of permsByRole.get(role.roleId) ?? []) {
      rows.push({
        userId: user.userId,
        email: user.email,
        roleKey: role.roleKey,
        resourceType: perm.resourceType,
        resourceKey: perm.resourceKey,
        expiresAt: grant.expiresAt,
      })
    }
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
      summary = { domains: [], tiers: [], roleKeys: [], via: {} }
      result.set(row.userId, summary)
    }
    const bucket = row.resourceType === 'domain' ? summary.domains : summary.tiers
    addUnique(bucket, row.resourceKey)
    addUnique(summary.roleKeys, row.roleKey)
    addUnique((summary.via[row.resourceKey] ??= []), row.roleKey)
  }
  return result
}

export const EMPTY_ACCESS: Readonly<UserAccessSummary> = Object.freeze({
  domains: [],
  tiers: [],
  roleKeys: [],
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
