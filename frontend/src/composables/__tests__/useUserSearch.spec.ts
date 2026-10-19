import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useUserSearch } from '../useUserSearch'
import { MAYANK, SHIVANI, SRIDHAR, createSeedDatabase } from '@/api/mock/seed'

describe('useUserSearch', () => {
  const users = ref(createSeedDatabase().users)

  it('matches first and last name together, case-insensitively', () => {
    const { query, results } = useUserSearch(users)
    query.value = 'sridhar IYER'
    expect(results.value.map((u) => u.email)).toEqual([SRIDHAR])
  })

  it('matches email and department', () => {
    const { query, results } = useUserSearch(users)
    query.value = 'shivani.semwal'
    expect(results.value.map((u) => u.email)).toEqual([SHIVANI])
    query.value = 'support'
    expect(results.value.map((u) => u.email)).toEqual([MAYANK])
  })

  it('filters by status and department, and resets', () => {
    const withInactive = ref(
      createSeedDatabase().users.map((u) => (u.email === MAYANK ? { ...u, isActive: false } : u)),
    )
    const { status, department, results, isFiltered, reset } = useUserSearch(withInactive)
    status.value = 'inactive'
    expect(results.value.map((u) => u.email)).toEqual([MAYANK])

    status.value = 'all'
    department.value = 'Data'
    expect(results.value.map((u) => u.email)).toEqual([SRIDHAR])
    expect(isFiltered.value).toBe(true)

    reset()
    expect(results.value).toHaveLength(4)
    expect(isFiltered.value).toBe(false)
  })
})
