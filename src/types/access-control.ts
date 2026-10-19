/**
 * Types mirroring the BigQuery dataset `roller_analytics_agent_access_control`
 * (see bapps-edp-analytics-mcp/semantic/migrations/003_access_control.sql).
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

/** `user_roles` — one row per grant. Append-only: revoke, never delete. */
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

export type GrantStatus = 'active' | 'scheduled' | 'expired' | 'revoked'

/** One row of the `effective_access` view: access a person has right now. */
export interface EffectiveAccessRow {
  userId: string
  email: string
  roleKey: string
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
  ownerTeam: string | null
  approverEmail: string | null
}

export type UpdateRoleInput = Partial<Omit<CreateRoleInput, 'roleKey'>> & { isActive?: boolean }

export interface GrantRoleInput {
  userId: string
  roleId: string
  grantedAt: string
  expiresAt: string | null
  grantedBy: string
  reason: string | null
}
