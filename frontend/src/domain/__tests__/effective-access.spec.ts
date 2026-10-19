import { describe, expect, it } from 'vitest'
import { computeEffectiveAccess, summarizeByUser } from '../effective-access'
import { createSeedDatabase } from '@/api/mock/seed'

/**
 * The seed mirrors dev_seed.sql, whose header lists the expected access for
 * each test user. These cases assert the same table.
 */
describe('computeEffectiveAccess (dev seed expectations)', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const db = createSeedDatabase(now)
  const summaries = summarizeByUser(computeEffectiveAccess(db, now))
  const accessOf = (email: string) => {
    const user = db.users.find((u) => u.email === email)!
    return summaries.get(user.userId)
  }

  it.each([
    ['sridhar.iyer@rollerdigital.com', ['sales', 'renewals']],
    ['test.finance@rollerdigital.com', ['finance', 'sales']],
    ['test.support@rollerdigital.com', ['support']],
  ])('%s sees %j', (email, domains) => {
    expect(accessOf(email)?.domains.sort()).toEqual([...domains].sort())
    expect(accessOf(email)?.tiers).toEqual([])
  })

  it('gives data_admin every domain plus the exploratory tier', () => {
    const admin = accessOf('test.admin@rollerdigital.com')
    expect(admin?.domains).toHaveLength(5)
    expect(admin?.tiers).toEqual(['exploratory'])
    expect(admin?.via.exploratory).toEqual(['data_admin'])
  })

  it.each([
    'test.expired@rollerdigital.com',
    'test.revoked@rollerdigital.com',
    'test.inactive@rollerdigital.com',
    'test.future@rollerdigital.com',
    'test.noroles@rollerdigital.com',
  ])('%s sees nothing', (email) => {
    expect(accessOf(email)).toBeUndefined()
  })

  it('drops all access when the role is retired', () => {
    const roles = db.roles.map((r) => (r.roleKey === 'sales_ops' ? { ...r, isActive: false } : r))
    const rows = computeEffectiveAccess({ ...db, roles }, now)
    expect(rows.some((r) => r.roleKey === 'sales_ops')).toBe(false)
  })
})
