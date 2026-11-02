import type {
  AddGroupMemberInput,
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

/**
 * Everything the UI needs from the access-control backend.
 *
 * Implementations: `HttpAccessControlApi` (real REST backend) and
 * `MockAccessControlApi` (in-browser, for local development). The acting
 * admin (created_by / updated_by / revoked_by) is resolved by the backend
 * from the signed-in session, never sent by the client.
 */
export interface AccessControlApi {
  /** The signed-in admin and which teams they manage. */
  getMe(): Promise<Me>

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

  /** Legacy direct grants: listed and revoked only, never created. */
  listGrants(): Promise<UserRole[]>
  /** Grants are append-only: revoking sets `revokedAt`, the row stays. */
  revokeGrant(userRoleId: string): Promise<UserRole>

  listTeams(): Promise<Team[]>
  createTeam(input: CreateTeamInput): Promise<Team>
  updateTeam(teamId: string, patch: UpdateTeamInput): Promise<Team>
  listTeamAdmins(): Promise<TeamAdmin[]>
  addTeamAdmin(teamId: string, email: string): Promise<TeamAdmin>
  removeTeamAdmin(teamAdminId: string): Promise<TeamAdmin>

  listGroups(): Promise<Group[]>
  createGroup(input: CreateGroupInput): Promise<Group>
  updateGroup(groupId: string, patch: UpdateGroupInput): Promise<Group>
  listGroupMembers(): Promise<GroupMember[]>
  addGroupMember(groupId: string, input: AddGroupMemberInput): Promise<GroupMember>
  /** Append-only: removing sets `removedAt`, the row stays. */
  removeGroupMember(groupMemberId: string): Promise<GroupMember>
  listGroupRoles(): Promise<GroupRole[]>
  addGroupRole(groupId: string, input: AddGroupRoleInput): Promise<GroupRole>
  revokeGroupRole(groupRoleId: string): Promise<GroupRole>
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
