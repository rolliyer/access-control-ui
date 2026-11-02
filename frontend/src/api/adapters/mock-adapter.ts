import { ApiError, type AccessControlApi } from '../access-control-api'
import { createSeedDatabase, type MockDatabase } from '../mock/seed'
import generatedDomains from '../mock/domains.generated.json'
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
} from '@/types/access-control'
import { isMembershipOpen } from '@/domain/grants'
import { MAX_BULK_EMAILS } from '@/domain/email-list'
import { TIERS } from '@/domain/resources'
import {
  normalizeEmail,
  validateEmail,
  validateGrantDates,
  validateGrantor,
  validateKey,
  validateRequired,
  validateRoleKey,
} from '@/domain/validation'

export interface MockApiOptions {
  /** The signed-in admin. The mock treats them as a global admin.
   * Recorded as created_by / updated_by / revoked_by. */
  actorEmail: string
  /** Where to persist between reloads. Pass null to keep data in memory only. */
  storage?: Storage | null
  storageKey?: string
  /** Simulated network latency in ms. */
  latencyMs?: number
  now?: () => Date
  /** Metric domains to serve. Defaults to the output of `npm run sync:domains`. */
  domains?: Domain[]
  /** Starting data when nothing is saved. Defaults to the sample data in mock/seed.ts. */
  seed?: (now: Date) => MockDatabase
}

// v3: sample data gained teams and groups; older saved data is ignored.
const DEFAULT_STORAGE_KEY = 'access-control-ui:mock-db:v3'

/**
 * In-browser stand-in for the backend. Enforces the same rules the tables
 * document (unique emails and keys, approver ≠ member, append-only memberships)
 * so the UI behaves as it will against the real API. The signed-in person is a
 * global admin here; team-admin limits are enforced by the real backend only.
 */
export class MockAccessControlApi implements AccessControlApi {
  private db: MockDatabase
  private readonly actor: string
  private readonly storage: Storage | null
  private readonly storageKey: string
  private readonly latencyMs: number
  private readonly now: () => Date
  private readonly domains: Domain[]
  private readonly seed: (now: Date) => MockDatabase

  constructor(options: MockApiOptions) {
    this.actor = options.actorEmail
    this.storage = options.storage === undefined ? safeLocalStorage() : options.storage
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
    this.latencyMs = options.latencyMs ?? 150
    this.now = options.now ?? (() => new Date())
    this.domains = options.domains ?? generatedDomains
    this.seed = options.seed ?? createSeedDatabase
    this.db = this.load() ?? this.seed(this.now())
  }

  /** Restores the original seed data. */
  reset(): void {
    this.db = this.seed(this.now())
    this.save()
  }

  getMe() {
    return this.respond((): Me => ({
      email: this.actor,
      isGlobalAdmin: true,
      adminTeamIds: this.db.teams.map((t) => t.teamId),
    }))
  }

  // ── Domains ─────────────────────────────────────────────────────────────

  listDomains() {
    return this.respond(() => this.domains)
  }

  // ── Users ───────────────────────────────────────────────────────────────

  listUsers() {
    return this.respond(() => this.db.users)
  }

  createUser(input: CreateUserInput) {
    return this.respond(() => {
      const email = normalizeEmail(input.email)
      assertValid(validateEmail(email))
      if (this.db.users.some((u) => u.email === email)) {
        throw new ApiError(`A user with email ${email} already exists.`, 409)
      }
      const user: User = {
        userId: crypto.randomUUID(),
        email,
        firstName: input.firstName.trim() || null,
        lastName: input.lastName.trim() || null,
        department: input.department?.trim() || null,
        entraObjectId: null,
        isActive: true,
        createdAt: this.timestamp(),
        createdBy: this.actor,
        updatedAt: null,
        updatedBy: null,
      }
      this.db.users.push(user)
      return user
    })
  }

  updateUser(userId: string, patch: UpdateUserInput) {
    return this.respond(() => {
      const user = this.findOrThrow(this.db.users, (u) => u.userId === userId, 'User')
      if (patch.email !== undefined) {
        const email = normalizeEmail(patch.email)
        assertValid(validateEmail(email))
        if (this.db.users.some((u) => u.email === email && u.userId !== userId)) {
          throw new ApiError(`A user with email ${email} already exists.`, 409)
        }
        user.email = email
      }
      if (patch.firstName !== undefined) user.firstName = patch.firstName.trim() || null
      if (patch.lastName !== undefined) user.lastName = patch.lastName.trim() || null
      if (patch.department !== undefined) user.department = patch.department?.trim() || null
      if (patch.isActive !== undefined) user.isActive = patch.isActive
      this.touch(user)
      return user
    })
  }

  // ── Roles ───────────────────────────────────────────────────────────────

  listRoles() {
    return this.respond(() => this.db.roles)
  }

  createRole(input: CreateRoleInput) {
    return this.respond(() => {
      assertValid(validateRoleKey(input.roleKey))
      if (this.db.roles.some((r) => r.roleKey === input.roleKey)) {
        throw new ApiError(`A role with key ${input.roleKey} already exists.`, 409)
      }
      const team = this.teamOrNull(input.teamId)
      const role: Role = {
        roleId: crypto.randomUUID(),
        roleKey: input.roleKey,
        roleName: input.roleName.trim(),
        description: input.description?.trim() || null,
        teamId: team?.teamId ?? null,
        ownerTeam: team?.teamName ?? null,
        approverEmail: input.approverEmail ? normalizeEmail(input.approverEmail) : null,
        entraGroup: null,
        isActive: true,
        createdAt: this.timestamp(),
        createdBy: this.actor,
        updatedAt: null,
        updatedBy: null,
      }
      this.db.roles.push(role)
      return role
    })
  }

  updateRole(roleId: string, patch: UpdateRoleInput) {
    return this.respond(() => {
      const role = this.findOrThrow(this.db.roles, (r) => r.roleId === roleId, 'Role')
      if (patch.roleName !== undefined) role.roleName = patch.roleName.trim()
      if (patch.description !== undefined) role.description = patch.description?.trim() || null
      if (patch.teamId !== undefined) {
        const team = this.teamOrNull(patch.teamId)
        role.teamId = team?.teamId ?? null
        role.ownerTeam = team?.teamName ?? null
      }
      if (patch.approverEmail !== undefined) {
        role.approverEmail = patch.approverEmail ? normalizeEmail(patch.approverEmail) : null
      }
      if (patch.isActive !== undefined) role.isActive = patch.isActive
      this.touch(role)
      return role
    })
  }

  // ── Permissions ─────────────────────────────────────────────────────────

  listPermissions() {
    return this.respond(() => this.db.permissions)
  }

  setRolePermissions(roleId: string, permissions: PermissionRef[]) {
    return this.respond(() => {
      this.findOrThrow(this.db.roles, (r) => r.roleId === roleId, 'Role')
      this.assertKnownResources(permissions)
      const wanted = new Map(permissions.map((p) => [`${p.resourceType}:${p.resourceKey}`, p]))
      const kept = this.db.permissions.filter(
        (p) => p.roleId !== roleId || wanted.delete(`${p.resourceType}:${p.resourceKey}`),
      )
      const added = [...wanted.values()].map((p): RolePermission => ({
        rolePermissionId: crypto.randomUUID(),
        roleId,
        resourceType: p.resourceType,
        resourceKey: p.resourceKey,
        createdAt: this.timestamp(),
        createdBy: this.actor,
      }))
      this.db.permissions = [...kept, ...added]
      return this.db.permissions.filter((p) => p.roleId === roleId)
    })
  }

  // ── Grants ──────────────────────────────────────────────────────────────

  listGrants() {
    return this.respond(() => this.db.grants)
  }

  revokeGrant(userRoleId: string) {
    return this.respond(() => {
      const grant = this.findOrThrow(this.db.grants, (g) => g.userRoleId === userRoleId, 'Grant')
      if (grant.revokedAt) throw new ApiError('This grant is already revoked.', 409)
      grant.revokedAt = this.timestamp()
      grant.revokedBy = this.actor
      return grant
    })
  }

  // ── Teams ───────────────────────────────────────────────────────────────

  listTeams() {
    return this.respond(() => this.db.teams)
  }

  createTeam(input: CreateTeamInput) {
    return this.respond(() => {
      assertValid(validateKey(input.teamKey, 'Team key', 'customer_success'))
      assertValid(validateRequired(input.teamName, 'Team name'))
      if (this.db.teams.some((t) => t.teamKey === input.teamKey)) {
        throw new ApiError(`A team with key ${input.teamKey} already exists.`, 409)
      }
      const team: Team = {
        teamId: crypto.randomUUID(),
        teamKey: input.teamKey,
        teamName: input.teamName.trim(),
        description: input.description?.trim() || null,
        isActive: true,
        createdAt: this.timestamp(),
        createdBy: this.actor,
        updatedAt: null,
        updatedBy: null,
      }
      this.db.teams.push(team)
      return team
    })
  }

  updateTeam(teamId: string, patch: UpdateTeamInput) {
    return this.respond(() => {
      const team = this.findOrThrow(this.db.teams, (t) => t.teamId === teamId, 'Team')
      if (patch.teamName !== undefined) team.teamName = patch.teamName.trim()
      if (patch.description !== undefined) team.description = patch.description?.trim() || null
      if (patch.isActive !== undefined) team.isActive = patch.isActive
      this.touch(team)
      return team
    })
  }

  listTeamAdmins() {
    return this.respond(() => this.db.teamAdmins)
  }

  addTeamAdmin(teamId: string, email: string) {
    return this.respond(() => {
      const team = this.findOrThrow(this.db.teams, (t) => t.teamId === teamId, 'Team')
      const normalized = normalizeEmail(email)
      assertValid(validateEmail(normalized))
      const exists = this.db.teamAdmins.some(
        (a) => a.teamId === teamId && a.email === normalized && !a.removedAt,
      )
      if (exists) throw new ApiError(`${normalized} is already an admin of ${team.teamName}.`, 409)
      const admin: TeamAdmin = {
        teamAdminId: crypto.randomUUID(),
        teamId,
        email: normalized,
        addedAt: this.timestamp(),
        addedBy: this.actor,
        removedAt: null,
        removedBy: null,
      }
      this.db.teamAdmins.push(admin)
      return admin
    })
  }

  removeTeamAdmin(teamAdminId: string) {
    return this.respond(() => {
      const admin = this.findOrThrow(
        this.db.teamAdmins,
        (a) => a.teamAdminId === teamAdminId,
        'Team admin',
      )
      if (admin.removedAt) throw new ApiError('This admin is already removed.', 409)
      admin.removedAt = this.timestamp()
      admin.removedBy = this.actor
      return admin
    })
  }

  // ── Groups ──────────────────────────────────────────────────────────────

  listGroups() {
    return this.respond(() => this.db.groups)
  }

  createGroup(input: CreateGroupInput) {
    return this.respond(() => {
      const team = this.findOrThrow(this.db.teams, (t) => t.teamId === input.teamId, 'Team')
      if (!team.isActive) throw new ApiError(`Team ${team.teamName} is retired.`, 422)
      assertValid(validateKey(input.groupKey, 'Group key', 'support_analysts'))
      assertValid(validateRequired(input.groupName, 'Group name'))
      if (this.db.groups.some((g) => g.groupKey === input.groupKey)) {
        throw new ApiError(`A group with key ${input.groupKey} already exists.`, 409)
      }
      const group: Group = {
        groupId: crypto.randomUUID(),
        groupKey: input.groupKey,
        groupName: input.groupName.trim(),
        description: input.description?.trim() || null,
        teamId: team.teamId,
        entraGroupId: input.entraGroupId?.trim() || null,
        isActive: true,
        createdAt: this.timestamp(),
        createdBy: this.actor,
        updatedAt: null,
        updatedBy: null,
      }
      this.db.groups.push(group)
      return group
    })
  }

  updateGroup(groupId: string, patch: UpdateGroupInput) {
    return this.respond(() => {
      const group = this.findOrThrow(this.db.groups, (g) => g.groupId === groupId, 'Group')
      if (patch.groupName !== undefined) group.groupName = patch.groupName.trim()
      if (patch.description !== undefined) group.description = patch.description?.trim() || null
      if (patch.entraGroupId !== undefined) group.entraGroupId = patch.entraGroupId?.trim() || null
      if (patch.isActive !== undefined) group.isActive = patch.isActive
      this.touch(group)
      return group
    })
  }

  listGroupMembers() {
    return this.respond(() => this.db.groupMembers)
  }

  addGroupMember(groupId: string, input: AddGroupMemberInput) {
    return this.respond(() => {
      const group = this.findOrThrow(this.db.groups, (g) => g.groupId === groupId, 'Group')
      if (!group.isActive) throw new ApiError(`Group ${group.groupName} is retired.`, 422)
      const user = this.findOrThrow(this.db.users, (u) => u.userId === input.userId, 'User')
      assertValid(validateGrantor(input.approvedBy, user.email))
      assertValid(validateGrantDates(input.addedAt, input.expiresAt))

      const now = this.now()
      const duplicate = this.db.groupMembers.some(
        (m) => m.groupId === groupId && m.userId === user.userId && isMembershipOpen(m, now),
      )
      if (duplicate) {
        throw new ApiError(
          `${user.email} is already in ${group.groupName}. Remove them first.`,
          409,
        )
      }

      const member: GroupMember = {
        groupMemberId: crypto.randomUUID(),
        groupId,
        userId: user.userId,
        addedAt: input.addedAt,
        addedBy: this.actor,
        approvedBy: normalizeEmail(input.approvedBy),
        expiresAt: input.expiresAt,
        removedAt: null,
        removedBy: null,
        reason: input.reason?.trim() || null,
      }
      this.db.groupMembers.push(member)
      return member
    })
  }

  addGroupMembers(groupId: string, input: AddGroupMembersInput) {
    return this.respond((): AddGroupMembersResult => {
      const group = this.findOrThrow(this.db.groups, (g) => g.groupId === groupId, 'Group')
      if (!group.isActive) throw new ApiError(`Group ${group.groupName} is retired.`, 422)
      const approver = normalizeEmail(input.approvedBy)
      assertValid(validateEmail(approver))
      assertValid(validateGrantDates(input.addedAt, input.expiresAt))

      const emails = [...new Set(input.emails.map(normalizeEmail).filter(Boolean))]
      if (!emails.length) throw new ApiError('Paste or upload at least one email.', 422)
      if (emails.length > MAX_BULK_EMAILS) {
        throw new ApiError(`Add at most ${MAX_BULK_EMAILS} people at a time.`, 422)
      }

      const now = this.now()
      const inGroup = new Set(
        this.db.groupMembers
          .filter((m) => m.groupId === groupId && isMembershipOpen(m, now))
          .map((m) => m.userId),
      )
      const result: AddGroupMembersResult = { added: [], createdUsers: [], skipped: [] }
      for (const email of emails) {
        let user = this.db.users.find((u) => u.email === email)
        let reason: string | null = null
        if (validateEmail(email)) reason = 'Not a valid @rollerdigital.com email.'
        else if (email === approver) reason = "The approver can't approve their own access."
        else if (!user && !input.createMissingUsers) reason = 'Not in the app yet.'
        else if (user && !user.isActive) reason = 'This person is deactivated.'
        else if (user && inGroup.has(user.userId)) reason = 'Already in the group.'
        if (reason) {
          result.skipped.push({ email, reason })
          continue
        }

        if (!user) {
          const [firstName, lastName] = nameFromEmail(email)
          user = {
            userId: crypto.randomUUID(),
            email,
            firstName,
            lastName,
            department: null,
            entraObjectId: null,
            isActive: true,
            createdAt: this.timestamp(),
            createdBy: this.actor,
            updatedAt: null,
            updatedBy: null,
          }
          this.db.users.push(user)
          result.createdUsers.push(user)
        }
        const member: GroupMember = {
          groupMemberId: crypto.randomUUID(),
          groupId,
          userId: user.userId,
          addedAt: input.addedAt,
          addedBy: this.actor,
          approvedBy: approver,
          expiresAt: input.expiresAt,
          removedAt: null,
          removedBy: null,
          reason: input.reason?.trim() || null,
        }
        this.db.groupMembers.push(member)
        result.added.push(member)
      }
      return result
    })
  }

  removeGroupMember(groupMemberId: string) {
    return this.respond(() => {
      const member = this.findOrThrow(
        this.db.groupMembers,
        (m) => m.groupMemberId === groupMemberId,
        'Membership',
      )
      if (member.removedAt) {
        throw new ApiError('This person is already removed from the group.', 409)
      }
      member.removedAt = this.timestamp()
      member.removedBy = this.actor
      return member
    })
  }

  listGroupRoles() {
    return this.respond(() => this.db.groupRoles)
  }

  addGroupRole(groupId: string, input: AddGroupRoleInput) {
    return this.respond(() => {
      const group = this.findOrThrow(this.db.groups, (g) => g.groupId === groupId, 'Group')
      const role = this.findOrThrow(this.db.roles, (r) => r.roleId === input.roleId, 'Role')
      if (!role.isActive) throw new ApiError(`Role ${role.roleKey} is retired.`, 422)
      const duplicate = this.db.groupRoles.some(
        (gr) => gr.groupId === groupId && gr.roleId === role.roleId && !gr.revokedAt,
      )
      if (duplicate) {
        throw new ApiError(`${group.groupName} already has ${role.roleName}.`, 409)
      }
      const groupRole: GroupRole = {
        groupRoleId: crypto.randomUUID(),
        groupId,
        roleId: role.roleId,
        grantedAt: this.timestamp(),
        grantedBy: this.actor,
        revokedAt: null,
        revokedBy: null,
        reason: input.reason?.trim() || null,
      }
      this.db.groupRoles.push(groupRole)
      return groupRole
    })
  }

  revokeGroupRole(groupRoleId: string) {
    return this.respond(() => {
      const groupRole = this.findOrThrow(
        this.db.groupRoles,
        (gr) => gr.groupRoleId === groupRoleId,
        'Group role',
      )
      if (groupRole.revokedAt) {
        throw new ApiError('This role is already removed from the group.', 409)
      }
      groupRole.revokedAt = this.timestamp()
      groupRole.revokedBy = this.actor
      return groupRole
    })
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Runs a mutation/read, persists, and returns a deep copy after simulated latency. */
  private async respond<T>(operation: () => T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    const result = operation()
    this.save()
    return structuredClone(result)
  }

  /** Unknown keys would grant nothing, silently — reject them (validate.sql "unknown resource"). */
  private assertKnownResources(permissions: PermissionRef[]): void {
    const known = new Set([
      ...this.domains.map((d) => `domain:${d.key}`),
      ...TIERS.map((t) => `tier:${t.key}`),
    ])
    const unknown = permissions
      .map((p) => `${p.resourceType}:${p.resourceKey}`)
      .filter((id) => !known.has(id))
    if (unknown.length) {
      throw new ApiError(`Unknown resource(s): ${unknown.join(', ')}. Sync domains first.`, 422)
    }
  }

  private teamOrNull(teamId: string | null | undefined): Team | null {
    if (!teamId) return null
    return this.findOrThrow(this.db.teams, (t) => t.teamId === teamId, 'Team')
  }

  private findOrThrow<T>(items: T[], predicate: (item: T) => boolean, label: string): T {
    const item = items.find(predicate)
    if (!item) throw new ApiError(`${label} not found.`, 404)
    return item
  }

  private touch(row: { updatedAt: string | null; updatedBy: string | null }): void {
    row.updatedAt = this.timestamp()
    row.updatedBy = this.actor
  }

  private timestamp(): string {
    return this.now().toISOString()
  }

  private load(): MockDatabase | null {
    try {
      const raw = this.storage?.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as MockDatabase) : null
    } catch {
      return null
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(this.db))
    } catch {
      // Storage unavailable (private mode, quota): keep working in memory.
    }
  }
}

/** Best guess at a name: jane.doe@… → Jane, Doe (matches the backend). */
function nameFromEmail(email: string): [string | null, string | null] {
  const parts = email
    .split('@')[0]!
    .split(/[._-]+/)
    .filter(Boolean)
  const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  if (!parts.length) return [null, null]
  return [cap(parts[0]!), parts.slice(1).map(cap).join(' ') || null]
}

function assertValid(error: string | null): void {
  if (error) throw new ApiError(error, 422)
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
