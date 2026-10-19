import type { Domain, PermissionRef } from '@/types/access-control'

export const EMAIL_DOMAIN = '@rollerdigital.com'

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@rollerdigital\.com$/
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

/** Emails must match the Entra sign-in name exactly: lowercase, trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns an error message, or null when valid. */
export function validateEmail(email: string): string | null {
  const value = normalizeEmail(email)
  if (!value) return 'Email is required.'
  if (!value.endsWith(EMAIL_DOMAIN)) return `Only ${EMAIL_DOMAIN} addresses are allowed.`
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address.'
  return null
}

export function validateRequired(value: string | null | undefined, label: string): string | null {
  return value?.trim() ? null : `${label} is required.`
}

export function validateRoleKey(roleKey: string): string | null {
  if (!roleKey.trim()) return 'Role key is required.'
  if (!ROLE_KEY_PATTERN.test(roleKey)) {
    return 'Use lowercase words joined with underscores, e.g. support_analyst.'
  }
  return null
}

/** Suggests a role key from a display name: "Support Analyst" → "support_analyst". */
export function toRoleKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function validateGrantor(grantedBy: string, granteeEmail: string): string | null {
  const emailError = validateEmail(grantedBy)
  if (emailError) return emailError
  if (normalizeEmail(grantedBy) === normalizeEmail(granteeEmail)) {
    return 'The approver cannot be the person receiving access.'
  }
  return null
}

export function validateGrantDates(grantedAt: string, expiresAt: string | null): string | null {
  if (!expiresAt) return null
  return new Date(expiresAt) > new Date(grantedAt) ? null : 'Expiry must be after the start date.'
}

/**
 * The `exploratory` tier can read any table, so it is only safe on a role
 * that already sees every domain (mirrors the check in validate.sql).
 */
export function exploratoryWarning(
  permissions: readonly PermissionRef[],
  allDomains: readonly Pick<Domain, 'key' | 'label'>[],
): string | null {
  const hasExploratory = permissions.some(
    (p) => p.resourceType === 'tier' && p.resourceKey === 'exploratory',
  )
  if (!hasExploratory) return null
  const domains = new Set(
    permissions.filter((p) => p.resourceType === 'domain').map((p) => p.resourceKey),
  )
  const missing = allDomains.filter((d) => !domains.has(d.key)).map((d) => d.label)
  return missing.length
    ? `Exploratory SQL can read every table, but this role cannot see: ${missing.join(', ')}.`
    : null
}

/**
 * Permission rows whose domain is not in the metrics catalogue. They grant
 * nothing (the match is exact), mirroring validate.sql's "unknown resource".
 */
export function unknownDomainKeys(
  permissions: readonly PermissionRef[],
  allDomains: readonly Pick<Domain, 'key'>[],
): string[] {
  const known = new Set(allDomains.map((d) => d.key))
  return [
    ...new Set(
      permissions
        .filter((p) => p.resourceType === 'domain' && !known.has(p.resourceKey))
        .map((p) => p.resourceKey),
    ),
  ]
}
