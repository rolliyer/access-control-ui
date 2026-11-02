import { describe, expect, it } from 'vitest'
import { computeEffectiveAccess, summarizeByUser } from '../effective-access'
import {
  ABHISEKH,
  MAYANK,
  SHIVANI,
  SRIDHAR,
  createSeedDatabase,
  type MockDatabase,
} from '@/api/mock/seed'
import { addDays } from '@/utils/date'

const now = new Date('2026-06-15T12:00:00Z')

function accessOf(db: MockDatabase, email: string, at: Date = now) {
  const user = db.users.find((u) => u.email === email)!
  return summarizeByUser(computeEffectiveAccess(db, at)).get(user.userId)
}

function membershipsOf(db: MockDatabase, email: string, groupKey: string) {
  const user = db.users.find((u) => u.email === email)!
  const group = db.groups.find((g) => g.groupKey === groupKey)!
  return db.groupMembers.filter((m) => m.userId === user.userId && m.groupId === group.groupId)
}

describe('computeEffectiveAccess on the sample data', () => {
  const db = createSeedDatabase(now)

  it('gives Sridhar (Data Admins group) every domain plus the exploratory tier', () => {
    const access = accessOf(db, SRIDHAR)
    expect(access?.domains).toHaveLength(5)
    expect(access?.tiers).toEqual(['exploratory'])
    expect(access?.via.exploratory).toEqual(['data_admin'])
    expect(access?.groupKeys).toEqual(['data_admins'])
  })

  it('ignores revoked direct grants: Mayank sees support only through his group', () => {
    expect(accessOf(db, MAYANK)?.domains).toEqual(['support'])
    expect(accessOf(db, MAYANK)?.via.support).toEqual(['support_analyst'])
  })

  it('ignores expired memberships, and still counts open direct grants', () => {
    // Finance Close has expired; the old direct Customer Success grant is still open.
    expect(accessOf(db, SHIVANI)?.domains.sort()).toEqual([
      'customer_success',
      'renewals',
      'sales',
      'support',
    ])
  })

  it('gives Abhisekh sales and support', () => {
    expect(accessOf(db, ABHISEKH)?.domains.sort()).toEqual(['sales', 'support'])
  })
})

describe('computeEffectiveAccess rules', () => {
  it('drops everything for an inactive user', () => {
    const db = createSeedDatabase(now)
    db.users.find((u) => u.email === MAYANK)!.isActive = false
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('drops access when the group is retired', () => {
    const db = createSeedDatabase(now)
    db.groups.find((g) => g.groupKey === 'support_analysts')!.isActive = false
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('drops access when the group’s team is retired', () => {
    const db = createSeedDatabase(now)
    db.teams.find((t) => t.teamKey === 'support')!.isActive = false
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('drops access when the role is removed from the group', () => {
    const db = createSeedDatabase(now)
    const group = db.groups.find((g) => g.groupKey === 'support_analysts')!
    db.groupRoles.find((gr) => gr.groupId === group.groupId)!.revokedAt = now.toISOString()
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('drops access when the role is retired', () => {
    const db = createSeedDatabase(now)
    db.roles.find((r) => r.roleKey === 'support_analyst')!.isActive = false
    expect(accessOf(db, MAYANK)).toBeUndefined()
    expect(accessOf(db, ABHISEKH)?.domains).toEqual(['sales'])
  })

  it('gives nothing before a membership starts', () => {
    const db = createSeedDatabase(now)
    membershipsOf(db, MAYANK, 'support_analysts')[0]!.addedAt = addDays(now, 1).toISOString()
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('gives nothing once a member is removed', () => {
    const db = createSeedDatabase(now)
    membershipsOf(db, MAYANK, 'support_analysts')[0]!.removedAt = now.toISOString()
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('gives nothing once a membership expires', () => {
    const db = createSeedDatabase(now)
    // Shivani's group memberships last one day; her old direct grant lasts 60.
    expect(accessOf(db, SHIVANI, addDays(now, 2))?.domains.sort()).toEqual([
      'customer_success',
      'renewals',
    ])
  })
})
