import type { Role, RolePermission, User, UserRole } from '@/types/access-control'
import { addDays } from '@/utils/date'

export interface MockDatabase {
  users: User[]
  roles: Role[]
  permissions: RolePermission[]
  grants: UserRole[]
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

  const roleDefs: [string, string, string, string][] = [
    ['sales_ops', 'Sales Ops', 'Sales operations and analysts', 'RevOps'],
    ['customer_success', 'Customer Success', 'Customer success team', 'Customer Success'],
    ['support_lead', 'Support Lead', 'Support leadership', 'Support'],
    ['finance_analyst', 'Finance Analyst', 'Finance team — sees bookings to reconcile', 'Finance'],
    ['exec', 'Executive', 'Leadership — every domain', 'Executive'],
    ['data_admin', 'Data Admin', 'Data team — every domain plus exploratory SQL', 'Data'],
    ['sales_analyst', 'Sales Analyst', 'Can see sales metrics: pipeline, ACV, win rate', 'Sales'],
    [
      'support_analyst',
      'Support Analyst',
      'Can see support metrics: ticket volume, SLAs, CSAT, resolution time',
      'Support',
    ],
  ]
  const roles: Role[] = roleDefs.map(([roleKey, roleName, description, ownerTeam]) => ({
    roleId: id('role'),
    roleKey,
    roleName,
    description,
    ownerTeam,
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

  const day = (offset: number) => addDays(now, offset).toISOString()
  // email, role, granted_at, expires_at, revoked_at, approver, reason
  const grantDefs: [string, string, string, string, string | null, string, string][] = [
    [
      SRIDHAR,
      'data_admin',
      day(-45),
      day(135),
      null,
      ABHISEKH,
      'Builds the access-control tooling',
    ],
    [MAYANK, 'support_analyst', day(-10), day(170), null, SRIDHAR, 'Support metrics access'],
    [MAYANK, 'support_lead', day(-40), day(140), day(-11), SRIDHAR, 'Replaced by Support Analyst'],
    [SHIVANI, 'sales_analyst', day(-1), day(1), null, SRIDHAR, 'Temporary 1-day access'],
    [SHIVANI, 'support_analyst', day(-1), day(1), null, SRIDHAR, 'Temporary 1-day access'],
    [SHIVANI, 'finance_analyst', day(-200), day(-20), null, SRIDHAR, 'Quarter-end reconciliation'],
    [ABHISEKH, 'sales_analyst', day(-5), day(360), null, SRIDHAR, '1-year access to sales'],
    [ABHISEKH, 'support_analyst', day(-5), day(360), null, SRIDHAR, '1-year access to support'],
  ]
  const grants: UserRole[] = grantDefs.map(
    ([email, key, grantedAt, expiresAt, revokedAt, grantedBy, reason]) => ({
      userRoleId: id('grant'),
      userId: userId(email),
      roleId: roleId(key),
      grantedAt,
      grantedBy,
      expiresAt,
      revokedAt,
      revokedBy: revokedAt ? SRIDHAR : null,
      reason,
    }),
  )

  return { users, roles, permissions, grants }
}
