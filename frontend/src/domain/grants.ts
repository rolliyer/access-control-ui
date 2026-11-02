import type { GrantStatus, GroupMember, UserRole } from '@/types/access-control'

/** Default access length recommended by the access-control guide. */
export const DEFAULT_GRANT_DAYS = 180

/** Access expiring within this many days is flagged as "expiring soon". */
export const EXPIRING_SOON_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A stretch of access: a direct grant or a group membership. Both follow the
 * same rules in the `effective_access` view.
 */
export interface AccessWindow {
  startsAt: string
  expiresAt: string | null
  /** When it was revoked or removed; null while open. */
  endedAt: string | null
}

export function grantWindow(grant: UserRole): AccessWindow {
  return { startsAt: grant.grantedAt, expiresAt: grant.expiresAt, endedAt: grant.revokedAt }
}

export function membershipWindow(member: GroupMember): AccessWindow {
  return { startsAt: member.addedAt, expiresAt: member.expiresAt, endedAt: member.removedAt }
}

/** Mirrors the conditions of the `effective_access` view. */
export function windowStatus(window: AccessWindow, now: Date = new Date()): GrantStatus {
  if (window.endedAt) return 'revoked'
  if (new Date(window.startsAt) > now) return 'scheduled'
  if (window.expiresAt && new Date(window.expiresAt) <= now) return 'expired'
  return 'active'
}

export function isWindowActive(window: AccessWindow, now: Date = new Date()): boolean {
  return windowStatus(window, now) === 'active'
}

/** Still removable: active or not started yet. */
export function isWindowOpen(window: AccessWindow, now: Date = new Date()): boolean {
  const status = windowStatus(window, now)
  return status === 'active' || status === 'scheduled'
}

export function daysUntilExpiry(window: AccessWindow, now: Date = new Date()): number | null {
  if (!window.expiresAt) return null
  return Math.ceil((new Date(window.expiresAt).getTime() - now.getTime()) / DAY_MS)
}

export function isExpiringSoon(
  window: AccessWindow,
  now: Date = new Date(),
  withinDays = EXPIRING_SOON_DAYS,
): boolean {
  if (!isWindowActive(window, now)) return false
  const days = daysUntilExpiry(window, now)
  return days !== null && days <= withinDays
}

export function grantStatus(grant: UserRole, now: Date = new Date()): GrantStatus {
  return windowStatus(grantWindow(grant), now)
}

export function isGrantActive(grant: UserRole, now: Date = new Date()): boolean {
  return isWindowActive(grantWindow(grant), now)
}

/** A grant that can still be revoked (it is active or has not started yet). */
export function isGrantOpen(grant: UserRole, now: Date = new Date()): boolean {
  return isWindowOpen(grantWindow(grant), now)
}

export function isMembershipActive(member: GroupMember, now: Date = new Date()): boolean {
  return isWindowActive(membershipWindow(member), now)
}

/** A membership that can still be removed, and blocks adding the person twice. */
export function isMembershipOpen(member: GroupMember, now: Date = new Date()): boolean {
  return isWindowOpen(membershipWindow(member), now)
}
