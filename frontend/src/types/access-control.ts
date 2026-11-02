/**
 * Types mirroring the BigQuery dataset `roller_analytics_agent_access_control`
 * (see bapps-edp-analytics-mcp/semantic/migrations/003_access_control.sql and
 * this repo's sql/005_teams_and_groups.sql).
 *
 * How access works: a person is in a group, the group has roles, and each
 * role lists what it can see. Teams own groups and roles.
 *
 * Column names are camelCased; timestamps are ISO-8601 strings (UTC).
 */

export type ResourceType = 'domain' | 'tier'

/**
 * A metric domain: a folder under `semantic/metrics/` in the analytics MCP
 * repo. `key` is the folder name and must equal `role_permissions.resource_key`.
 */
export interface Domain {
  key: string
  label: string
  /** Metric files in the folder (excluding `_domain.yaml`). */
  metricCount: number
  /** Listed in the agent's `metrics_dirs`, so the agent actually serves it. */
  loadedByAgent: boolean
}

/** `users` — one row per person. Deactivate, never delete. */
export interface User {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  department: string | null
  entraObjectId: string | null
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string | null
}

/** `roles` — one row per kind of access. Retire, never delete. */
export interface Role {
  roleId: string
  roleKey: string
  roleName: string
  description: string | null
  /** The team that owns the role. Null = only global admins can hand it out. */
  teamId: string | null
  /** The owning team's name, kept for readability in BigQuery. */
  ownerTeam: string | null
  approverEmail: string | null
  entraGroup: string | null
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string | null
}

/** `role_permissions` — which resources each role may see. */
export interface RolePermission {
  rolePermissionId: string
  roleId: string
  resourceType: ResourceType
  resourceKey: string
  createdAt: string
  createdBy: string
}

/**
 * `user_roles` — a direct grant to one person. Legacy: access now goes through
 * groups, so these can only be revoked. Append-only: revoke, never delete.
 */
export interface UserRole {
  userRoleId: string
  userId: string
  roleId: string
  grantedAt: string
  grantedBy: string
  expiresAt: string | null
  revokedAt: string | null
  revokedBy: string | null
  reason: string | null
}

/** `teams` — a part of Roller that manages its own groups. Retire, never delete. */
export interface Team {
  teamId: string
  teamKey: string
  teamName: string
  description: string | null
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string | null
}

/** `team_admins` — who manages a team's groups. Append-only: remove, never delete. */
export interface TeamAdmin {
  teamAdminId: string
  teamId: string
  email: string
  addedAt: string
  addedBy: string
  removedAt: string | null
  removedBy: string | null
}

/** `groups` — people who get the same roles. Owned by one team. */
export interface Group {
  groupId: string
  groupKey: string
  groupName: string
  description: string | null
  teamId: string
  /** The Entra group this will be synced from later (optional). */
  entraGroupId: string | null
  isActive: boolean
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string | null
}

/** `group_members` — a person in a group. Append-only: remove, never delete. */
export interface GroupMember {
  groupMemberId: string
  groupId: string
  userId: string
  addedAt: string
  addedBy: string
  approvedBy: string
  expiresAt: string | null
  removedAt: string | null
  removedBy: string | null
  reason: string | null
}

/** `group_roles` — a role given to a group. Append-only: revoke, never delete. */
export interface GroupRole {
  groupRoleId: string
  groupId: string
  roleId: string
  grantedAt: string
  grantedBy: string
  revokedAt: string | null
  revokedBy: string | null
  reason: string | null
}

/** The signed-in admin. */
export interface Me {
  email: string
  /** Global admins manage everything; team admins only their teams' groups. */
  isGlobalAdmin: boolean
  adminTeamIds: string[]
}

export type GrantStatus = 'active' | 'scheduled' | 'expired' | 'revoked'

/** One row of the `effective_access` view: access a person has right now. */
export interface EffectiveAccessRow {
  userId: string
  email: string
  roleKey: string
  /** The group that gives this access; null for a legacy direct grant. */
  groupKey: string | null
  resourceType: ResourceType
  resourceKey: string
  expiresAt: string | null
}

export interface PermissionRef {
  resourceType: ResourceType
  resourceKey: string
}

// ── Inputs ────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string
  firstName: string
  lastName: string
  department: string | null
}

export type UpdateUserInput = Partial<CreateUserInput> & { isActive?: boolean }

export interface CreateRoleInput {
  roleKey: string
  roleName: string
  description: string | null
  /** The team that owns the role. Null = only global admins can hand it out. */
  teamId: string | null
  approverEmail: string | null
}

export type UpdateRoleInput = Partial<Omit<CreateRoleInput, 'roleKey'>> & { isActive?: boolean }

export interface CreateTeamInput {
  teamKey: string
  teamName: string
  description: string | null
}

export type UpdateTeamInput = Partial<Omit<CreateTeamInput, 'teamKey'>> & { isActive?: boolean }

export interface CreateGroupInput {
  groupKey: string
  groupName: string
  teamId: string
  description: string | null
  entraGroupId: string | null
}

export type UpdateGroupInput = Partial<Omit<CreateGroupInput, 'groupKey' | 'teamId'>> & {
  isActive?: boolean
}

export interface AddGroupMemberInput {
  userId: string
  addedAt: string
  expiresAt: string | null
  approvedBy: string
  reason: string | null
}

export interface AddGroupRoleInput {
  roleId: string
  reason: string | null
}
