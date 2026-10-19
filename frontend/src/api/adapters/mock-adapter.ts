import { ApiError, type AccessControlApi } from '../access-control-api'
import { createSeedDatabase, type MockDatabase } from '../mock/seed'
import generatedDomains from '../mock/domains.generated.json'
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
import { isGrantOpen } from '@/domain/grants'
import { TIERS } from '@/domain/resources'
import {
  normalizeEmail,
  validateEmail,
  validateGrantDates,
  validateGrantor,
  validateRoleKey,
} from '@/domain/validation'

export interface MockApiOptions {
  /** Email recorded as created_by / updated_by / revoked_by. */
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

// v2: sample data changed to the four real dev users; older saved data is ignored.
const DEFAULT_STORAGE_KEY = 'access-control-ui:mock-db:v2'

/**
 * In-browser stand-in for the backend. Enforces the same rules the tables
 * document (unique emails and role keys, approver ≠ grantee, append-only grants)
 * so the UI behaves as it will against the real API.
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
      const role: Role = {
        roleId: crypto.randomUUID(),
        roleKey: input.roleKey,
        roleName: input.roleName.trim(),
        description: input.description?.trim() || null,
        ownerTeam: input.ownerTeam?.trim() || null,
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
      if (patch.ownerTeam !== undefined) role.ownerTeam = patch.ownerTeam?.trim() || null
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

  grantRole(input: GrantRoleInput) {
    return this.respond(() => {
      const user = this.findOrThrow(this.db.users, (u) => u.userId === input.userId, 'User')
      const role = this.findOrThrow(this.db.roles, (r) => r.roleId === input.roleId, 'Role')
      assertValid(validateGrantor(input.grantedBy, user.email))
      assertValid(validateGrantDates(input.grantedAt, input.expiresAt))
      if (!role.isActive) throw new ApiError(`Role ${role.roleKey} is retired.`, 422)

      const now = this.now()
      const duplicate = this.db.grants.some(
        (g) => g.userId === user.userId && g.roleId === role.roleId && isGrantOpen(g, now),
      )
      if (duplicate) {
        throw new ApiError(`${user.email} already holds ${role.roleName}. Revoke it first.`, 409)
      }

      const grant: UserRole = {
        userRoleId: crypto.randomUUID(),
        userId: user.userId,
        roleId: role.roleId,
        grantedAt: input.grantedAt,
        grantedBy: normalizeEmail(input.grantedBy),
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedBy: null,
        reason: input.reason?.trim() || null,
      }
      this.db.grants.push(grant)
      return grant
    })
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
