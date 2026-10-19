import type {
  CreateRoleInput,
  CreateUserInput,
  Domain,
  GrantRoleInput,
  PermissionRef,
  Role,
  RolePermission,
  UpdateRoleInput,
  UpdateUserInput,
  User,
  UserRole,
} from '@/types/access-control'

/**
 * Everything the UI needs from the access-control backend.
 *
 * Implementations: `HttpAccessControlApi` (real REST backend) and
 * `MockAccessControlApi` (in-browser, for local development). The acting
 * admin (created_by / updated_by / revoked_by) is resolved by the backend
 * from the signed-in session, never sent by the client.
 */
export interface AccessControlApi {
  /** Metric domains discovered from the semantic catalogue (read-only). */
  listDomains(): Promise<Domain[]>

  listUsers(): Promise<User[]>
  createUser(input: CreateUserInput): Promise<User>
  updateUser(userId: string, patch: UpdateUserInput): Promise<User>

  listRoles(): Promise<Role[]>
  createRole(input: CreateRoleInput): Promise<Role>
  updateRole(roleId: string, patch: UpdateRoleInput): Promise<Role>

  listPermissions(): Promise<RolePermission[]>
  /** Replaces the role's permission set; returns the role's resulting rows. */
  setRolePermissions(roleId: string, permissions: PermissionRef[]): Promise<RolePermission[]>

  listGrants(): Promise<UserRole[]>
  grantRole(input: GrantRoleInput): Promise<UserRole>
  /** Grants are append-only: revoking sets `revokedAt`, the row stays. */
  revokeGrant(userRoleId: string): Promise<UserRole>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
