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

function grantsOf(db: MockDatabase, email: string, roleKey: string) {
  const user = db.users.find((u) => u.email === email)!
  const role = db.roles.find((r) => r.roleKey === roleKey)!
  return db.grants.filter((g) => g.userId === user.userId && g.roleId === role.roleId)
}

describe('computeEffectiveAccess on the sample data', () => {
  const db = createSeedDatabase(now)

  it('gives Sridhar (Data Admin) every domain plus the exploratory tier', () => {
    const access = accessOf(db, SRIDHAR)
    expect(access?.domains).toHaveLength(5)
    expect(access?.tiers).toEqual(['exploratory'])
    expect(access?.via.exploratory).toEqual(['data_admin'])
  })

  it('ignores revoked grants: Mayank sees support only through Support Analyst', () => {
    expect(accessOf(db, MAYANK)?.domains).toEqual(['support'])
    expect(accessOf(db, MAYANK)?.via.support).toEqual(['support_analyst'])
  })

  it('ignores expired grants: Shivani sees sales and support, not finance', () => {
    expect(accessOf(db, SHIVANI)?.domains.sort()).toEqual(['sales', 'support'])
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

  it('drops access when the role is retired', () => {
    const db = createSeedDatabase(now)
    db.roles.find((r) => r.roleKey === 'support_analyst')!.isActive = false
    expect(accessOf(db, MAYANK)).toBeUndefined()
    expect(accessOf(db, ABHISEKH)?.domains).toEqual(['sales'])
  })

  it('gives nothing before a grant starts', () => {
    const db = createSeedDatabase(now)
    grantsOf(db, MAYANK, 'support_analyst')[0]!.grantedAt = addDays(now, 1).toISOString()
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('gives nothing once a grant is revoked', () => {
    const db = createSeedDatabase(now)
    grantsOf(db, MAYANK, 'support_analyst')[0]!.revokedAt = now.toISOString()
    expect(accessOf(db, MAYANK)).toBeUndefined()
  })

  it('gives nothing once a grant expires', () => {
    const db = createSeedDatabase(now)
    // Shivani's sample grants last one day.
    expect(accessOf(db, SHIVANI, addDays(now, 2))).toBeUndefined()
  })
})
