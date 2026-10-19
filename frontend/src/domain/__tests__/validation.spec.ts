import { describe, expect, it } from 'vitest'
import {
  exploratoryWarning,
  unknownDomainKeys,
  normalizeEmail,
  toRoleKey,
  validateEmail,
  validateGrantDates,
  validateGrantor,
  validateRoleKey,
} from '../validation'
import type { PermissionRef } from '@/types/access-control'

describe('email rules', () => {
  it('normalizes to trimmed lowercase', () => {
    expect(normalizeEmail('  Mayank.Agarwal@RollerDigital.com ')).toBe(
      'mayank.agarwal@rollerdigital.com',
    )
  })

  it('accepts rollerdigital.com addresses in any case', () => {
    expect(validateEmail('Mayank.Agarwal@rollerdigital.com')).toBeNull()
  })

  it('rejects empty, other domains and malformed addresses', () => {
    expect(validateEmail('')).toMatch(/required/)
    expect(validateEmail('mayank.agarwal@gmail.com')).toMatch(/rollerdigital\.com/)
    expect(validateEmail('mayank agarwal@rollerdigital.com')).toMatch(/valid/)
  })
})

describe('role keys', () => {
  it('accepts snake_case', () => {
    expect(validateRoleKey('support_analyst')).toBeNull()
  })

  it.each(['Support', 'support-analyst', 'support__analyst', '_support', '1support'])(
    'rejects %s',
    (key) => expect(validateRoleKey(key)).not.toBeNull(),
  )

  it('suggests a key from a display name', () => {
    expect(toRoleKey('  Support Analyst (EMEA) ')).toBe('support_analyst_emea')
  })
})

describe('grant rules', () => {
  it('rejects self-approval', () => {
    expect(
      validateGrantor('Mayank.Agarwal@rollerdigital.com', 'mayank.agarwal@rollerdigital.com'),
    ).toMatch(/cannot/)
    expect(
      validateGrantor('sridhar.iyer@rollerdigital.com', 'mayank.agarwal@rollerdigital.com'),
    ).toBeNull()
  })

  it('requires expiry after start', () => {
    expect(validateGrantDates('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).not.toBeNull()
    expect(validateGrantDates('2026-01-01T00:00:00Z', '2026-07-01T00:00:00Z')).toBeNull()
    expect(validateGrantDates('2026-01-01T00:00:00Z', null)).toBeNull()
  })
})

const CATALOG = [
  { key: 'sales', label: 'Sales' },
  { key: 'renewals', label: 'Renewals' },
  { key: 'customer_success', label: 'Customer Success' },
  { key: 'support', label: 'Support' },
  { key: 'finance', label: 'Finance' },
]

describe('exploratoryWarning', () => {
  const domains = (...keys: string[]): PermissionRef[] =>
    keys.map((resourceKey) => ({ resourceType: 'domain', resourceKey }))
  const exploratory: PermissionRef = { resourceType: 'tier', resourceKey: 'exploratory' }

  it('is silent without the exploratory tier', () => {
    expect(exploratoryWarning(domains('sales'), CATALOG)).toBeNull()
  })

  it('warns when the role lacks some domains', () => {
    expect(exploratoryWarning([...domains('sales'), exploratory], CATALOG)).toMatch(/Renewals/)
  })

  it('is silent when the role sees every domain', () => {
    const all = domains('sales', 'renewals', 'customer_success', 'support', 'finance')
    expect(exploratoryWarning([...all, exploratory], CATALOG)).toBeNull()
  })
})

describe('unknownDomainKeys', () => {
  it('lists domain keys missing from the catalogue, once each, ignoring tiers', () => {
    const keys = unknownDomainKeys(
      [
        { resourceType: 'domain', resourceKey: 'sales' },
        { resourceType: 'domain', resourceKey: 'Support' },
        { resourceType: 'domain', resourceKey: 'Support' },
        { resourceType: 'tier', resourceKey: 'exploratory' },
      ],
      CATALOG,
    )
    expect(keys).toEqual(['Support'])
  })
})
