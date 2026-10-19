import { beforeEach, describe, expect, it } from 'vitest'
import { MockAccessControlApi } from '../adapters/mock-adapter'
import { ApiError } from '../access-control-api'

const ACTOR = 'admin@rollerdigital.com'

describe('MockAccessControlApi', () => {
  let api: MockAccessControlApi

  beforeEach(() => {
    api = new MockAccessControlApi({
      actorEmail: ACTOR,
      storage: null,
      latencyMs: 0,
      domains: ['sales', 'renewals', 'customer_success', 'support', 'finance'].map((key) => ({
        key,
        label: key,
        metricCount: 1,
        loadedByAgent: true,
      })),
    })
  })

  it('creates users with a normalized email and audit fields', async () => {
    const user = await api.createUser({
      email: '  New.Person@RollerDigital.com ',
      firstName: 'New',
      lastName: 'Person',
      department: '',
    })
    expect(user).toMatchObject({
      email: 'new.person@rollerdigital.com',
      department: null,
      isActive: true,
      createdBy: ACTOR,
    })
  })

  it('rejects duplicate emails', async () => {
    await expect(
      api.createUser({
        email: 'test.support@rollerdigital.com',
        firstName: 'A',
        lastName: 'B',
        department: null,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects non-Roller emails', async () => {
    await expect(
      api.createUser({ email: 'x@gmail.com', firstName: 'A', lastName: 'B', department: null }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('returns copies so callers cannot mutate the store', async () => {
    const [first] = await api.listUsers()
    first!.email = 'changed@rollerdigital.com'
    const [again] = await api.listUsers()
    expect(again!.email).not.toBe('changed@rollerdigital.com')
  })

  describe('grants', () => {
    async function ids() {
      const users = await api.listUsers()
      const roles = await api.listRoles()
      return {
        user: users.find((u) => u.email === 'test.noroles@rollerdigital.com')!,
        role: roles.find((r) => r.roleKey === 'support_lead')!,
      }
    }

    it('grants a role, blocks duplicates, and revokes without deleting', async () => {
      const { user, role } = await ids()
      const input = {
        userId: user.userId,
        roleId: role.roleId,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        grantedBy: ACTOR,
        reason: 'Covering support',
      }
      const grant = await api.grantRole(input)
      await expect(api.grantRole(input)).rejects.toMatchObject({ status: 409 })

      const revoked = await api.revokeGrant(grant.userRoleId)
      expect(revoked.revokedBy).toBe(ACTOR)
      expect((await api.listGrants()).some((g) => g.userRoleId === grant.userRoleId)).toBe(true)

      // Once revoked, the role can be granted again.
      await expect(api.grantRole(input)).resolves.toBeTruthy()
    })

    it('rejects self-approval', async () => {
      const { user, role } = await ids()
      await expect(
        api.grantRole({
          userId: user.userId,
          roleId: role.roleId,
          grantedAt: new Date().toISOString(),
          expiresAt: null,
          grantedBy: user.email,
          reason: null,
        }),
      ).rejects.toMatchObject({ status: 422 })
    })
  })

  it('replaces a role permission set, keeping unchanged rows', async () => {
    const role = (await api.listRoles()).find((r) => r.roleKey === 'sales_ops')!
    const before = (await api.listPermissions()).filter((p) => p.roleId === role.roleId)
    const salesRow = before.find((p) => p.resourceKey === 'sales')!

    const after = await api.setRolePermissions(role.roleId, [
      { resourceType: 'domain', resourceKey: 'sales' },
      { resourceType: 'domain', resourceKey: 'finance' },
    ])

    expect(after.map((p) => p.resourceKey).sort()).toEqual(['finance', 'sales'])
    expect(after.find((p) => p.resourceKey === 'sales')!.rolePermissionId).toBe(
      salesRow.rolePermissionId,
    )
  })

  it('serves the domain catalogue and rejects permissions for unknown domains', async () => {
    expect((await api.listDomains()).map((d) => d.key)).toContain('support')
    const role = (await api.listRoles())[0]!
    await expect(
      api.setRolePermissions(role.roleId, [{ resourceType: 'domain', resourceKey: 'Support' }]),
    ).rejects.toMatchObject({ status: 422 })
  })
})
