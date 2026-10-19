import type { Domain, PermissionRef, ResourceType } from '@/types/access-control'

export interface ResourceDefinition {
  type: ResourceType
  key: string
  label: string
  description: string
}

/**
 * Special capabilities. Unlike domains these are features of the agent's code,
 * not folders of metrics, so the list is fixed here. Grant rarely.
 */
export const TIERS: readonly ResourceDefinition[] = [
  {
    type: 'tier',
    key: 'exploratory',
    label: 'Exploratory SQL',
    description:
      'Agent writes its own SQL and can read any table. Only for roles that see every domain.',
  },
  {
    type: 'tier',
    key: 'looker',
    label: 'Looker direct',
    description: 'Forces questions straight to Looker. Mainly for testing.',
  },
]

/** Domains come from the metrics catalogue at runtime; this adapts them for pickers and grids. */
export function domainToResource(domain: Domain): ResourceDefinition {
  const metrics = `${domain.metricCount} metric${domain.metricCount === 1 ? '' : 's'}`
  return {
    type: 'domain',
    key: domain.key,
    label: domain.label,
    description: domain.loadedByAgent ? metrics : `${metrics} · not loaded by the agent yet`,
  }
}

export function resourceId(ref: PermissionRef): string {
  return `${ref.resourceType}:${ref.resourceKey}`
}

/** "customer_success" → "Customer Success", for keys missing from the catalogue. */
export function humanizeKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
