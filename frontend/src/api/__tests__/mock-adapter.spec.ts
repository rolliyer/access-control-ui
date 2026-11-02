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
          groupMembers: db.groupMembers.filter((m) => m.userId !== abhisekh.userId),
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

  describe('groups', () => {
    async function ids() {
      const users = await api.listUsers()
      const groups = await api.listGroups()
      return {
        // Abhisekh isn't in Finance Close in the sample data.
        user: users.find((u) => u.email === ABHISEKH)!,
        group: groups.find((g) => g.groupKey === 'finance_close')!,
      }
    }

    it('adds a member, blocks duplicates, and removes without deleting', async () => {
      const { user, group } = await ids()
      const input = {
        userId: user.userId,
        addedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        approvedBy: SRIDHAR,
        reason: 'Covering finance',
      }
      const member = await api.addGroupMember(group.groupId, input)
      expect(member).toMatchObject({ addedBy: ACTOR, approvedBy: SRIDHAR })
      await expect(api.addGroupMember(group.groupId, input)).rejects.toMatchObject({ status: 409 })

      const removed = await api.removeGroupMember(member.groupMemberId)
      expect(removed.removedBy).toBe(ACTOR)
      const all = await api.listGroupMembers()
      expect(all.some((m) => m.groupMemberId === member.groupMemberId)).toBe(true)

      // Once removed, the person can be added again.
      await expect(api.addGroupMember(group.groupId, input)).resolves.toBeTruthy()
    })

    it('rejects self-approval', async () => {
      const { user, group } = await ids()
      await expect(
        api.addGroupMember(group.groupId, {
          userId: user.userId,
          addedAt: new Date().toISOString(),
          expiresAt: null,
          approvedBy: user.email,
          reason: null,
        }),
      ).rejects.toMatchObject({ status: 422 })
    })

    it('creates a group with roles, and refuses a duplicate role', async () => {
      const team = (await api.listTeams()).find((t) => t.teamKey === 'support')!
      const role = (await api.listRoles()).find((r) => r.roleKey === 'support_lead')!
      const group = await api.createGroup({
        groupKey: 'support_leads',
        groupName: 'Support Leads',
        teamId: team.teamId,
        description: null,
        entraGroupId: null,
      })
      await api.addGroupRole(group.groupId, { roleId: role.roleId, reason: null })
      await expect(
        api.addGroupRole(group.groupId, { roleId: role.roleId, reason: null }),
      ).rejects.toMatchObject({ status: 409 })
      await expect(
        api.createGroup({ ...group, description: null, entraGroupId: null }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('bulk-adds people, creating missing ones only when asked', async () => {
      const { group } = await ids()
      const input = {
        emails: [ABHISEKH, MAYANK, SRIDHAR, 'new.person@rollerdigital.com', 'x@gmail.com'],
        addedAt: new Date().toISOString(),
        expiresAt: null,
        approvedBy: SRIDHAR,
        reason: 'Onboarding',
        createMissingUsers: false,
      }
      const first = await api.addGroupMembers(group.groupId, input)
      expect(first.added).toHaveLength(2)
      expect(first.skipped.map((s) => s.reason)).toEqual([
        "The approver can't approve their own access.",
        'Not in the app yet.',
        'Not a valid @rollerdigital.com email.',
      ])

      const second = await api.addGroupMembers(group.groupId, {
        ...input,
        createMissingUsers: true,
      })
      expect(second.added).toHaveLength(1)
      expect(second.createdUsers[0]).toMatchObject({ firstName: 'New', lastName: 'Person' })
      expect(second.skipped.filter((s) => s.reason === 'Already in the group.')).toHaveLength(2)
    })

    it('manages team admins, append-only', async () => {
      const team = (await api.listTeams()).find((t) => t.teamKey === 'finance')!
      const admin = await api.addTeamAdmin(team.teamId, ' Shivani.Semwal@RollerDigital.com ')
      expect(admin.email).toBe('shivani.semwal@rollerdigital.com')
      await expect(api.addTeamAdmin(team.teamId, admin.email)).rejects.toMatchObject({
        status: 409,
      })
      expect((await api.removeTeamAdmin(admin.teamAdminId)).removedBy).toBe(ACTOR)
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
