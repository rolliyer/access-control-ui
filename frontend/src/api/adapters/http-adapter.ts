import type { AccessControlApi } from '../access-control-api'
import type { HttpClient } from '../http-client'
import type {
  AddGroupMemberInput,
  AddGroupMembersInput,
  AddGroupMembersResult,
  AddGroupRoleInput,
  CreateGroupInput,
  CreateRoleInput,
  CreateTeamInput,
  CreateUserInput,
  Domain,
  Group,
  GroupMember,
  GroupRole,
  Me,
  PermissionRef,
  Role,
  RolePermission,
  Team,
  TeamAdmin,
  UpdateGroupInput,
  UpdateRoleInput,
  UpdateTeamInput,
  UpdateUserInput,
  User,
  UserRole,
} from '@/types/access-control'

const id = encodeURIComponent

/**
 * REST contract expected from the backend (camelCase JSON):
 *
 *   GET    /me
 *   GET    /domains                   (folders under semantic/metrics/ with _domain.yaml;
 *                                      loadedByAgent = listed in the agent's metrics_dirs)
 *   GET    /users                     POST /users          PATCH /users/:id
 *   GET    /roles                     POST /roles          PATCH /roles/:id
 *   GET    /role-permissions          PUT  /roles/:id/permissions
 *   GET    /grants                    POST /grants/:id/revoke
 *   GET    /teams                     POST /teams          PATCH /teams/:id
 *   GET    /team-admins               POST /teams/:id/admins       POST /team-admins/:id/remove
 *   GET    /groups                    POST /groups         PATCH /groups/:id
 *   GET    /group-members             POST /groups/:id/members     POST /group-members/:id/remove
 *                                      POST /groups/:id/members/bulk
 *   GET    /group-roles               POST /groups/:id/roles       POST /group-roles/:id/revoke
 */
export class HttpAccessControlApi implements AccessControlApi {
  constructor(private readonly http: HttpClient) {}

  getMe() {
    return this.http.request<Me>('GET', '/me')
  }

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
    return this.http.request<User>('PATCH', `/users/${id(userId)}`, patch)
  }

  listRoles() {
    return this.http.request<Role[]>('GET', '/roles')
  }
  createRole(input: CreateRoleInput) {
    return this.http.request<Role>('POST', '/roles', input)
  }
  updateRole(roleId: string, patch: UpdateRoleInput) {
    return this.http.request<Role>('PATCH', `/roles/${id(roleId)}`, patch)
  }

  listPermissions() {
    return this.http.request<RolePermission[]>('GET', '/role-permissions')
  }
  setRolePermissions(roleId: string, permissions: PermissionRef[]) {
    return this.http.request<RolePermission[]>('PUT', `/roles/${id(roleId)}/permissions`, {
      permissions,
    })
  }

  listGrants() {
    return this.http.request<UserRole[]>('GET', '/grants')
  }
  revokeGrant(userRoleId: string) {
    return this.http.request<UserRole>('POST', `/grants/${id(userRoleId)}/revoke`)
  }

  listTeams() {
    return this.http.request<Team[]>('GET', '/teams')
  }
  createTeam(input: CreateTeamInput) {
    return this.http.request<Team>('POST', '/teams', input)
  }
  updateTeam(teamId: string, patch: UpdateTeamInput) {
    return this.http.request<Team>('PATCH', `/teams/${id(teamId)}`, patch)
  }
  listTeamAdmins() {
    return this.http.request<TeamAdmin[]>('GET', '/team-admins')
  }
  addTeamAdmin(teamId: string, email: string) {
    return this.http.request<TeamAdmin>('POST', `/teams/${id(teamId)}/admins`, { email })
  }
  removeTeamAdmin(teamAdminId: string) {
    return this.http.request<TeamAdmin>('POST', `/team-admins/${id(teamAdminId)}/remove`)
  }

  listGroups() {
    return this.http.request<Group[]>('GET', '/groups')
  }
  createGroup(input: CreateGroupInput) {
    return this.http.request<Group>('POST', '/groups', input)
  }
  updateGroup(groupId: string, patch: UpdateGroupInput) {
    return this.http.request<Group>('PATCH', `/groups/${id(groupId)}`, patch)
  }
  listGroupMembers() {
    return this.http.request<GroupMember[]>('GET', '/group-members')
  }
  addGroupMember(groupId: string, input: AddGroupMemberInput) {
    return this.http.request<GroupMember>('POST', `/groups/${id(groupId)}/members`, input)
  }
  addGroupMembers(groupId: string, input: AddGroupMembersInput) {
    return this.http.request<AddGroupMembersResult>(
      'POST',
      `/groups/${id(groupId)}/members/bulk`,
      input,
    )
  }
  removeGroupMember(groupMemberId: string) {
    return this.http.request<GroupMember>('POST', `/group-members/${id(groupMemberId)}/remove`)
  }
  listGroupRoles() {
    return this.http.request<GroupRole[]>('GET', '/group-roles')
  }
  addGroupRole(groupId: string, input: AddGroupRoleInput) {
    return this.http.request<GroupRole>('POST', `/groups/${id(groupId)}/roles`, input)
  }
  revokeGroupRole(groupRoleId: string) {
    return this.http.request<GroupRole>('POST', `/group-roles/${id(groupRoleId)}/revoke`)
  }
}
