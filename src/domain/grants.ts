import type { GrantStatus, UserRole } from '@/types/access-control'

/** Default grant length recommended by the access-control guide. */
export const DEFAULT_GRANT_DAYS = 180

/** Grants expiring within this many days are flagged as "expiring soon". */
export const EXPIRING_SOON_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Mirrors the grant conditions of the `effective_access` view. */
export function grantStatus(grant: UserRole, now: Date = new Date()): GrantStatus {
  if (grant.revokedAt) return 'revoked'
  if (new Date(grant.grantedAt) > now) return 'scheduled'
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) return 'expired'
  return 'active'
}

export function isGrantActive(grant: UserRole, now: Date = new Date()): boolean {
  return grantStatus(grant, now) === 'active'
}

/** A grant that can still be revoked (it is active or has not started yet). */
export function isGrantOpen(grant: UserRole, now: Date = new Date()): boolean {
  const status = grantStatus(grant, now)
  return status === 'active' || status === 'scheduled'
}

export function daysUntilExpiry(grant: UserRole, now: Date = new Date()): number | null {
  if (!grant.expiresAt) return null
  return Math.ceil((new Date(grant.expiresAt).getTime() - now.getTime()) / DAY_MS)
}

export function isExpiringSoon(
  grant: UserRole,
  now: Date = new Date(),
  withinDays = EXPIRING_SOON_DAYS,
): boolean {
  if (!isGrantActive(grant, now)) return false
  const days = daysUntilExpiry(grant, now)
  return days !== null && days <= withinDays
}
