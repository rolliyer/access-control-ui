import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type { CreateUserInput, UpdateUserInput, User } from '@/types/access-control'
import { fullName } from '@/utils/user'

export const useUsersStore = defineStore('users', () => {
  const api = useApi()

  const users = ref<User[]>([])

  const byId = computed(() => new Map(users.value.map((u) => [u.userId, u])))
  const sorted = computed(() =>
    [...users.value].sort((a, b) => fullName(a).localeCompare(fullName(b))),
  )
  const activeCount = computed(() => users.value.filter((u) => u.isActive).length)
  const departments = computed(() =>
    [
      ...new Set(users.value.map((u) => u.department).filter((d): d is string => Boolean(d))),
    ].sort(),
  )

  async function fetchAll(): Promise<void> {
    users.value = await api.listUsers()
  }

  async function create(input: CreateUserInput): Promise<User> {
    const user = await api.createUser(input)
    users.value.push(user)
    return user
  }

  async function update(userId: string, patch: UpdateUserInput): Promise<User> {
    const updated = await api.updateUser(userId, patch)
    replace(updated)
    return updated
  }

  function setActive(userId: string, isActive: boolean): Promise<User> {
    return update(userId, { isActive })
  }

  function replace(user: User): void {
    const index = users.value.findIndex((u) => u.userId === user.userId)
    if (index >= 0) users.value[index] = user
  }

  return { users, byId, sorted, activeCount, departments, fetchAll, create, update, setActive }
})
