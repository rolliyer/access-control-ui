import type { User } from '@/types/access-control'

export function fullName(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email
}

export function initials(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const letters = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.charAt(0))
    .join('')
  return (letters || user.email.charAt(0)).toUpperCase()
}

/** Case-insensitive match against name, email and department. */
export function matchesUserQuery(user: User, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = [user.firstName, user.lastName, user.email, user.department]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}
