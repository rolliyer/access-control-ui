import { beforeEach, describe, expect, it } from 'vitest'
import { MockAccessControlApi, type MockApiOptions } from '../adapters/mock-adapter'
import { ApiError } from '../access-control-api'
import { ABHISEKH, MAYANK, SRIDHAR, createSeedDatabase } from '../mock/seed'

const ACTOR = SRIDHAR

function createApi(options: Partial<MockApiOptions> = {}) {
  return new MockAccessControlApi({
    actorEmail: ACTOR,
    storage: null,
    latencyMs: 0,
    domains: ['sales', 'renewals', 'customer_success', 'support', 'finance'].map((key) => ({
      key,
      label: key,
      metricCount: 1,
      loadedByAgent: true,
    })),
    ...options,
  })
}

describe('MockAccessControlApi', () => {
  let api: MockAccessControlApi

  beforeEach(() => {
    api = createApi()
  })

  it('creates users with a normalized email and audit fields', async () => {
    // Start without Abhisekh, then add him.
    const withoutAbhisekh = createApi({
      seed: (now) => {
        const db = createSeedDatabase(now)
        const abhisekh = db.users.find((u) => u.email === ABHISEKH)!
        return {
          ...db,
          users: db.users.filter((u) => u !== abhisekh),
          grants: db.grants.filter((g) => g.userId !== abhisekh.userId),
        }
      },
    })
    const user = await withoutAbhisekh.createUser({
      email: '  Abhisekh.Banerjee@RollerDigital.com ',
      firstName: 'Abhisekh',
      lastName: 'Banerjee',
      department: '',
    })
    expect(user).toMatchObject({
      email: ABHISEKH,
      department: null,
      isActive: true,
      createdBy: ACTOR,
    })
  })

  it('rejects duplicate emails', async () => {
    await expect(
      api.createUser({ email: MAYANK, firstName: 'Mayank', lastName: 'Agarwal', department: null }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects non-Roller emails', async () => {
    await expect(
      api.createUser({
        email: 'mayank.agarwal@gmail.com',
        firstName: 'Mayank',
        lastName: 'Agarwal',
        department: null,
      }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('returns copies so callers cannot mutate the store', async () => {
    const [first] = await api.listUsers()
    first!.email = 'changed'
    const [again] = await api.listUsers()
    expect(again!.email).not.toBe('changed')
  })

  describe('grants', () => {
    async function ids() {
      const users = await api.listUsers()
      const roles = await api.listRoles()
      return {
        // Abhisekh doesn't hold Finance Analyst in the sample data.
        user: users.find((u) => u.email === ABHISEKH)!,
        role: roles.find((r) => r.roleKey === 'finance_analyst')!,
      }
    }

    it('grants a role, blocks duplicates, and revokes without deleting', async () => {
      const { user, role } = await ids()
      const input = {
        userId: user.userId,
        roleId: role.roleId,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        grantedBy: SRIDHAR,
        reason: 'Covering finance',
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
