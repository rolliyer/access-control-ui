import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useUserSearch } from '../useUserSearch'
import { createSeedDatabase } from '@/api/mock/seed'

describe('useUserSearch', () => {
  const users = ref(createSeedDatabase().users)

  it('matches first and last name together, case-insensitively', () => {
    const { query, results } = useUserSearch(users)
    query.value = 'sridhar IYER'
    expect(results.value.map((u) => u.email)).toEqual(['sridhar.iyer@rollerdigital.com'])
  })

  it('matches email and department', () => {
    const { query, results } = useUserSearch(users)
    query.value = 'test.finance'
    expect(results.value).toHaveLength(1)
    query.value = 'marketing'
    expect(results.value.map((u) => u.email)).toEqual(['test.noroles@rollerdigital.com'])
  })

  it('filters by status and department, and resets', () => {
    const { status, department, results, isFiltered, reset } = useUserSearch(users)
    status.value = 'inactive'
    expect(results.value.map((u) => u.email)).toEqual(['test.inactive@rollerdigital.com'])

    status.value = 'all'
    department.value = 'Data'
    expect(results.value).toHaveLength(2)
    expect(isFiltered.value).toBe(true)

    reset()
    expect(results.value).toHaveLength(users.value.length)
    expect(isFiltered.value).toBe(false)
  })
})
