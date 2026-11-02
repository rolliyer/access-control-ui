import { describe, expect, it } from 'vitest'
import {
  daysUntilExpiry,
  grantStatus,
  grantWindow,
  isExpiringSoon,
  isGrantOpen,
  isMembershipOpen,
} from '../grants'
import type { GroupMember, UserRole } from '@/types/access-control'

const now = new Date('2026-06-15T12:00:00Z')
const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86_400_000).toISOString()

function grant(overrides: Partial<UserRole> = {}): UserRole {
  return {
    userRoleId: 'g1',
    userId: 'u1',
    roleId: 'r1',
    grantedAt: iso(-10),
    grantedBy: 'sridhar.iyer@rollerdigital.com',
    expiresAt: iso(100),
    revokedAt: null,
    revokedBy: null,
    reason: null,
    ...overrides,
  }
}

describe('grantStatus', () => {
  it('is active between start and expiry', () => {
    expect(grantStatus(grant(), now)).toBe('active')
  })

  it('is active with no expiry', () => {
    expect(grantStatus(grant({ expiresAt: null }), now)).toBe('active')
  })

  it('is scheduled before the start date', () => {
    expect(grantStatus(grant({ grantedAt: iso(1) }), now)).toBe('scheduled')
  })

  it('is expired at or after the expiry', () => {
    expect(grantStatus(grant({ expiresAt: iso(-1) }), now)).toBe('expired')
    expect(grantStatus(grant({ expiresAt: now.toISOString() }), now)).toBe('expired')
  })

  it('treats revoked as final, whatever the dates', () => {
    expect(grantStatus(grant({ revokedAt: iso(-1), grantedAt: iso(1) }), now)).toBe('revoked')
  })
})

describe('isGrantOpen', () => {
  it('is true for active and scheduled grants only', () => {
    expect(isGrantOpen(grant(), now)).toBe(true)
    expect(isGrantOpen(grant({ grantedAt: iso(5) }), now)).toBe(true)
    expect(isGrantOpen(grant({ expiresAt: iso(-1) }), now)).toBe(false)
    expect(isGrantOpen(grant({ revokedAt: iso(-1) }), now)).toBe(false)
  })
})

describe('expiry helpers', () => {
  it('counts whole days until expiry', () => {
    expect(daysUntilExpiry(grantWindow(grant({ expiresAt: iso(20) })), now)).toBe(20)
    expect(daysUntilExpiry(grantWindow(grant({ expiresAt: null })), now)).toBeNull()
  })

  it('flags active grants expiring within the window', () => {
    const soon = (overrides: Partial<UserRole>) =>
      isExpiringSoon(grantWindow(grant(overrides)), now)
    expect(soon({ expiresAt: iso(10) })).toBe(true)
    expect(soon({ expiresAt: iso(60) })).toBe(false)
    expect(soon({ expiresAt: iso(10), revokedAt: iso(-1) })).toBe(false)
  })
})

describe('isMembershipOpen', () => {
  const member = (overrides: Partial<GroupMember> = {}): GroupMember => ({
    groupMemberId: 'm1',
    groupId: 'g1',
    userId: 'u1',
    addedAt: iso(-10),
    addedBy: 'sridhar.iyer@rollerdigital.com',
    approvedBy: 'mayank.agarwal@rollerdigital.com',
    expiresAt: iso(100),
    removedAt: null,
    removedBy: null,
    reason: null,
    ...overrides,
  })

  it('follows the same rules as grants', () => {
    expect(isMembershipOpen(member(), now)).toBe(true)
    expect(isMembershipOpen(member({ addedAt: iso(5) }), now)).toBe(true)
    expect(isMembershipOpen(member({ expiresAt: iso(-1) }), now)).toBe(false)
    expect(isMembershipOpen(member({ removedAt: iso(-1) }), now)).toBe(false)
  })
})
