import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { User } from '@/types/access-control'
import { matchesUserQuery } from '@/utils/user'

export type UserStatusFilter = 'all' | 'active' | 'inactive'

export interface UserSearchFilters {
  query: string
  status: UserStatusFilter
  department: string
}

/** Reactive name/email/department search plus status and department filters. */
export function useUserSearch(
  users: MaybeRefOrGetter<readonly User[]>,
  initial: Partial<UserSearchFilters> = {},
) {
  const query = ref(initial.query ?? '')
  const status = ref<UserStatusFilter>(initial.status ?? 'all')
  const department = ref(initial.department ?? '')

  const results = computed(() =>
    toValue(users).filter(
      (user) =>
        (status.value === 'all' || user.isActive === (status.value === 'active')) &&
        (!department.value || user.department === department.value) &&
        matchesUserQuery(user, query.value),
    ),
  )

  const isFiltered = computed(
    () => Boolean(query.value.trim()) || status.value !== 'all' || Boolean(department.value),
  )

  function reset(): void {
    query.value = ''
    status.value = 'all'
    department.value = ''
  }

  return { query, status, department, results, isFiltered, reset }
}
