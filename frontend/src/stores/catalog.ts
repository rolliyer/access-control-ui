import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { Domain, PermissionRef } from '@/types/access-control'
import {
  TIERS,
  domainToResource,
  humanizeKey,
  resourceId,
  type ResourceDefinition,
} from '@/domain/resources'

/**
 * What can be granted: metric domains (discovered from the semantic catalogue
 * via the API) plus the fixed special tiers.
 */
export const useCatalogStore = defineStore('catalog', () => {
  const api = useApi()

  const domains = ref<Domain[]>([])

  const sortedDomains = computed(() =>
    [...domains.value].sort((a, b) => a.label.localeCompare(b.label)),
  )
  const domainResources = computed(() => sortedDomains.value.map(domainToResource))
  const allResources = computed<ResourceDefinition[]>(() => [...domainResources.value, ...TIERS])
  const resourcesById = computed(
    () =>
      new Map(
        allResources.value.map((r) => [
          resourceId({ resourceType: r.type, resourceKey: r.key }),
          r,
        ]),
      ),
  )

  function isKnown(ref: PermissionRef): boolean {
    return resourcesById.value.has(resourceId(ref))
  }

  function labelFor(ref: PermissionRef): string {
    return resourcesById.value.get(resourceId(ref))?.label ?? humanizeKey(ref.resourceKey)
  }

  /** Sort keys in catalogue order; unknown keys go last. */
  function orderOf(ref: PermissionRef): number {
    const index = allResources.value.findIndex(
      (r) => r.type === ref.resourceType && r.key === ref.resourceKey,
    )
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }

  async function fetchAll(): Promise<void> {
    domains.value = await api.listDomains()
  }

  return {
    domains,
    sortedDomains,
    domainResources,
    allResources,
    isKnown,
    labelFor,
    orderOf,
    fetchAll,
  }
})
