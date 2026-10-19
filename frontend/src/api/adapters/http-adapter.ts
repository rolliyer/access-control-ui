import type { AccessControlApi } from '../access-control-api'
import type { HttpClient } from '../http-client'
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
 * REST contract expected from the backend (camelCase JSON):
 *
 *   GET    /domains                   (folders under semantic/metrics/ with _domain.yaml;
 *                                      loadedByAgent = listed in the agent's metrics_dirs)
 *   GET    /users                     POST /users          PATCH /users/:id
 *   GET    /roles                     POST /roles          PATCH /roles/:id
 *   GET    /role-permissions          PUT  /roles/:id/permissions
 *   GET    /grants                    POST /grants         POST  /grants/:id/revoke
 */
export class HttpAccessControlApi implements AccessControlApi {
  constructor(private readonly http: HttpClient) {}

  listDomains() {
    return this.http.request<Domain[]>('GET', '/domains')
  }

  listUsers() {
    return this.http.request<User[]>('GET', '/users')
  }
  createUser(input: CreateUserInput) {
    return this.http.request<User>('POST', '/users', input)
  }
  updateUser(userId: string, patch: UpdateUserInput) {
    return this.http.request<User>('PATCH', `/users/${encodeURIComponent(userId)}`, patch)
  }

  listRoles() {
    return this.http.request<Role[]>('GET', '/roles')
  }
  createRole(input: CreateRoleInput) {
    return this.http.request<Role>('POST', '/roles', input)
  }
  updateRole(roleId: string, patch: UpdateRoleInput) {
    return this.http.request<Role>('PATCH', `/roles/${encodeURIComponent(roleId)}`, patch)
  }

  listPermissions() {
    return this.http.request<RolePermission[]>('GET', '/role-permissions')
  }
  setRolePermissions(roleId: string, permissions: PermissionRef[]) {
    return this.http.request<RolePermission[]>(
      'PUT',
      `/roles/${encodeURIComponent(roleId)}/permissions`,
      { permissions },
    )
  }

  listGrants() {
    return this.http.request<UserRole[]>('GET', '/grants')
  }
  grantRole(input: GrantRoleInput) {
    return this.http.request<UserRole>('POST', '/grants', input)
  }
  revokeGrant(userRoleId: string) {
    return this.http.request<UserRole>('POST', `/grants/${encodeURIComponent(userRoleId)}/revoke`)
  }
}
