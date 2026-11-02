import type {
  Group,
  GroupMember,
  GroupRole,
  Role,
  RolePermission,
  Team,
  TeamAdmin,
  User,
  UserRole,
} from '@/types/access-control'
import { addDays } from '@/utils/date'

export interface MockDatabase {
  users: User[]
  roles: Role[]
  permissions: RolePermission[]
  grants: UserRole[]
  teams: Team[]
  teamAdmins: TeamAdmin[]
  groups: Group[]
  groupMembers: GroupMember[]
  groupRoles: GroupRole[]
}

export const SRIDHAR = 'sridhar.iyer@rollerdigital.com'
export const MAYANK = 'mayank.agarwal@rollerdigital.com'
export const SHIVANI = 'shivani.semwal@rollerdigital.com'
export const ABHISEKH = 'abhisekh.banerjee@rollerdigital.com'

/**
 * Sample data. The only people are the four in the analytics MCP repo's dev
 * grant scripts (semantic/access_control/dev_grant_*.sql); the roles are
 * those of dev_seed.sql plus sales_analyst and support_analyst from the grant
 * scripts. Kept identical to backend/app/store/memory.py.
 */
export function createSeedDatabase(now: Date = new Date()): MockDatabase {
  const created = addDays(now, -90).toISOString()
  let seq = 0
  const id = (prefix: string) => `${prefix}-${String(++seq).padStart(4, '0')}`
  const day = (offset: number) => addDays(now, offset).toISOString()

  // key, name, description, admin
  const teamDefs: [string, string, string, string | null][] = [
    ['data', 'Data', 'Data platform and analytics engineering', SRIDHAR],
    ['sales', 'Sales', 'Sales and revenue operations', ABHISEKH],
    ['support', 'Support', 'Customer support', MAYANK],
    ['finance', 'Finance', 'Finance and accounting', null],
  ]
  const teams: Team[] = teamDefs.map(([teamKey, teamName, description]) => ({
    teamId: id('team'),
    teamKey,
    teamName,
    description,
    isActive: true,
    createdAt: created,
    createdBy: SRIDHAR,
    updatedAt: null,
    updatedBy: null,
  }))
  const team = (key: string) => teams.find((t) => t.teamKey === key)!
  const teamAdmins: TeamAdmin[] = teamDefs
    .filter(([, , , admin]) => admin)
    .map(([key, , , admin]) => ({
      teamAdminId: id('tadmin'),
      teamId: team(key).teamId,
      email: admin!,
      addedAt: created,
      addedBy: SRIDHAR,
      removedAt: null,
      removedBy: null,
    }))

  // key, name, description, owning team (null = global admins only)
  const roleDefs: [string, string, string, string | null][] = [
    ['sales_ops', 'Sales Ops', 'Sales operations and analysts', 'sales'],
    ['customer_success', 'Customer Success', 'Customer success team', null],
    ['support_lead', 'Support Lead', 'Support leadership', 'support'],
    ['finance_analyst', 'Finance Analyst', 'Finance team — sees bookings to reconcile', 'finance'],
    ['exec', 'Executive', 'Leadership — every domain', null],
    ['data_admin', 'Data Admin', 'Data team — every domain plus exploratory SQL', 'data'],
    ['sales_analyst', 'Sales Analyst', 'Can see sales metrics: pipeline, ACV, win rate', 'sales'],
    [
      'support_analyst',
      'Support Analyst',
      'Can see support metrics: ticket volume, SLAs, CSAT, resolution time',
      'support',
    ],
  ]
  const roles: Role[] = roleDefs.map(([roleKey, roleName, description, teamKey]) => ({
    roleId: id('role'),
    roleKey,
    roleName,
    description,
    teamId: teamKey ? team(teamKey).teamId : null,
    ownerTeam: teamKey ? team(teamKey).teamName : null,
    approverEmail: SRIDHAR,
    entraGroup: null,
    isActive: true,
    createdAt: created,
    createdBy: SRIDHAR,
    updatedAt: null,
    updatedBy: null,
  }))
  const roleId = (key: string) => roles.find((r) => r.roleKey === key)!.roleId

  const allDomains = ['sales', 'renewals', 'customer_success', 'support', 'finance']
  const permDefs: [string, 'domain' | 'tier', string][] = [
    ['sales_ops', 'domain', 'sales'],
    ['sales_ops', 'domain', 'renewals'],
    ['customer_success', 'domain', 'customer_success'],
    ['customer_success', 'domain', 'renewals'],
    ['support_lead', 'domain', 'support'],
    ['finance_analyst', 'domain', 'finance'],
    ['finance_analyst', 'domain', 'sales'],
    ...allDomains.map((d): [string, 'domain', string] => ['exec', 'domain', d]),
    ...allDomains.map((d): [string, 'domain', string] => ['data_admin', 'domain', d]),
    ['data_admin', 'tier', 'exploratory'],
    ['sales_analyst', 'domain', 'sales'],
    ['support_analyst', 'domain', 'support'],
  ]
  const permissions: RolePermission[] = permDefs.map(([key, resourceType, resourceKey]) => ({
    rolePermissionId: id('perm'),
    roleId: roleId(key),
    resourceType,
    resourceKey,
    createdAt: created,
    createdBy: SRIDHAR,
  }))

  const userDefs: [string, string, string, string | null][] = [
    [SRIDHAR, 'Sridhar', 'Iyer', 'Data'],
    [MAYANK, 'Mayank', 'Agarwal', 'Support'],
    [SHIVANI, 'Shivani', 'Semwal', null],
    [ABHISEKH, 'Abhisekh', 'Banerjee', null],
  ]
  const users: User[] = userDefs.map(([email, firstName, lastName, department]) => ({
    userId: id('user'),
    email,
    firstName,
    lastName,
    department,
    entraObjectId: null,
    isActive: true,
    createdAt: created,
    createdBy: SRIDHAR,
    updatedAt: null,
    updatedBy: null,
  }))
  const userId = (email: string) => users.find((u) => u.email === email)!.userId

  // key, name, team, roles
  const groupDefs: [string, string, string, string[]][] = [
    ['data_admins', 'Data Admins', 'data', ['data_admin']],
    ['sales_analysts', 'Sales Analysts', 'sales', ['sales_analyst']],
    ['support_analysts', 'Support Analysts', 'support', ['support_analyst']],
    ['finance_close', 'Finance Close', 'finance', ['finance_analyst']],
  ]
  const groups: Group[] = groupDefs.map(([groupKey, groupName, teamKey]) => ({
    groupId: id('group'),
    groupKey,
    groupName,
    description: null,
    teamId: team(teamKey).teamId,
    entraGroupId: null,
    isActive: true,
    createdAt: created,
    createdBy: SRIDHAR,
    updatedAt: null,
    updatedBy: null,
  }))
  const groupId = (key: string) => groups.find((g) => g.groupKey === key)!.groupId
  const groupRoles: GroupRole[] = groupDefs.flatMap(([key, , , roleKeys]) =>
    roleKeys.map((roleKey) => ({
      groupRoleId: id('grole'),
      groupId: groupId(key),
      roleId: roleId(roleKey),
      grantedAt: created,
      grantedBy: SRIDHAR,
      revokedAt: null,
      revokedBy: null,
      reason: null,
    })),
  )

  // email, group, added_at, expires_at, removed_at, approver, reason
  const memberDefs: [string, string, string, string, string | null, string, string][] = [
    [
      SRIDHAR,
      'data_admins',
      day(-45),
      day(135),
      null,
      ABHISEKH,
      'Builds the access-control tooling',
    ],
    [MAYANK, 'support_analysts', day(-10), day(170), null, SRIDHAR, 'Support metrics access'],
    [SHIVANI, 'sales_analysts', day(-1), day(1), null, SRIDHAR, 'Temporary 1-day access'],
    [SHIVANI, 'support_analysts', day(-1), day(1), null, SRIDHAR, 'Temporary 1-day access'],
    [SHIVANI, 'finance_close', day(-200), day(-20), null, SRIDHAR, 'Quarter-end reconciliation'],
    [ABHISEKH, 'sales_analysts', day(-5), day(360), null, SRIDHAR, '1-year access to sales'],
    [ABHISEKH, 'support_analysts', day(-5), day(360), null, SRIDHAR, '1-year access to support'],
  ]
  const groupMembers: GroupMember[] = memberDefs.map(
    ([email, key, addedAt, expiresAt, removedAt, approvedBy, reason]) => ({
      groupMemberId: id('member'),
      groupId: groupId(key),
      userId: userId(email),
      addedAt,
      addedBy: SRIDHAR,
      approvedBy,
      expiresAt,
      removedAt,
      removedBy: removedAt ? SRIDHAR : null,
      reason,
    }),
  )

  // Direct grants from before groups existed: one revoked, one still active.
  const grants: UserRole[] = [
    {
      userRoleId: id('grant'),
      userId: userId(MAYANK),
      roleId: roleId('support_lead'),
      grantedAt: day(-40),
      grantedBy: SRIDHAR,
      expiresAt: day(140),
      revokedAt: day(-11),
      revokedBy: SRIDHAR,
      reason: 'Replaced by Support Analysts group',
    },
    {
      userRoleId: id('grant'),
      userId: userId(SHIVANI),
      roleId: roleId('customer_success'),
      grantedAt: day(-30),
      grantedBy: SRIDHAR,
      expiresAt: day(60),
      revokedAt: null,
      revokedBy: null,
      reason: 'Granted before groups — move to a group',
    },
  ]

  return { users, roles, permissions, grants, teams, teamAdmins, groups, groupMembers, groupRoles }
}
