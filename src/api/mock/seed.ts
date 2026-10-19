import type { Role, RolePermission, User, UserRole } from '@/types/access-control'
import { addDays } from '@/utils/date'

export interface MockDatabase {
  users: User[]
  roles: Role[]
  permissions: RolePermission[]
  grants: UserRole[]
}

/**
 * Mirrors semantic/access_control/dev_seed.sql in the analytics MCP repo:
 * the same roles and permissions, and users that exercise every grant rule
 * (active, expired, revoked, inactive user, future start, no roles).
 */
export function createSeedDatabase(now: Date = new Date()): MockDatabase {
  const admin = 'sridhar.iyer@rollerdigital.com'
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
  ]
  const roles: Role[] = roleDefs.map(([roleKey, roleName, description, ownerTeam]) => ({
    roleId: id('role'),
    roleKey,
    roleName,
    description,
    ownerTeam,
    approverEmail: admin,
    entraGroup: null,
    isActive: true,
    createdAt: created,
    createdBy: admin,
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
  ]
  const permissions: RolePermission[] = permDefs.map(([key, resourceType, resourceKey]) => ({
    rolePermissionId: id('perm'),
    roleId: roleId(key),
    resourceType,
    resourceKey,
    createdAt: created,
    createdBy: admin,
  }))

  const userDefs: [string, string, string, string, boolean][] = [
    ['sridhar.iyer@rollerdigital.com', 'Sridhar', 'Iyer', 'Data', true],
    ['test.finance@rollerdigital.com', 'Test', 'Finance', 'Finance', true],
    ['test.support@rollerdigital.com', 'Test', 'Support', 'Support', true],
    ['test.admin@rollerdigital.com', 'Test', 'Admin', 'Data', true],
    ['test.expired@rollerdigital.com', 'Test', 'Expired', 'RevOps', true],
    ['test.revoked@rollerdigital.com', 'Test', 'Revoked', 'RevOps', true],
    ['test.inactive@rollerdigital.com', 'Test', 'Inactive', 'RevOps', false],
    ['test.future@rollerdigital.com', 'Test', 'Future', 'RevOps', true],
    ['test.noroles@rollerdigital.com', 'Test', 'Noroles', 'Marketing', true],
  ]
  const users: User[] = userDefs.map(([email, firstName, lastName, department, isActive]) => ({
    userId: id('user'),
    email,
    firstName,
    lastName,
    department,
    entraObjectId: null,
    isActive,
    createdAt: created,
    createdBy: admin,
    updatedAt: null,
    updatedBy: null,
  }))
  const userId = (email: string) => users.find((u) => u.email === email)!.userId

  const day = (offset: number) => addDays(now, offset).toISOString()
  const grantDefs: [string, string, string, string | null, string | null, string][] = [
    // email, role, granted_at, expires_at, revoked_at, reason
    ['sridhar.iyer@rollerdigital.com', 'sales_ops', day(-30), day(150), null, 'Dev testing'],
    [
      'test.finance@rollerdigital.com',
      'finance_analyst',
      day(-60),
      day(20),
      null,
      'Joined Finance',
    ],
    ['test.support@rollerdigital.com', 'support_lead', day(-10), day(170), null, 'Support lead'],
    ['test.admin@rollerdigital.com', 'data_admin', day(-45), day(135), null, 'Data team'],
    ['test.expired@rollerdigital.com', 'sales_ops', day(-200), day(-1), null, 'Expired test'],
    ['test.revoked@rollerdigital.com', 'sales_ops', day(-20), day(160), day(-2), 'Revoked test'],
    ['test.inactive@rollerdigital.com', 'sales_ops', day(-20), day(160), null, 'Inactive test'],
    ['test.future@rollerdigital.com', 'sales_ops', day(1), day(181), null, 'Starts tomorrow'],
  ]
  const grants: UserRole[] = grantDefs.map(
    ([email, key, grantedAt, expiresAt, revokedAt, reason]) => ({
      userRoleId: id('grant'),
      userId: userId(email),
      roleId: roleId(key),
      grantedAt,
      grantedBy: email === admin ? 'test.admin@rollerdigital.com' : admin,
      expiresAt,
      revokedAt,
      revokedBy: revokedAt ? admin : null,
      reason,
    }),
  )

  return { users, roles, permissions, grants }
}
