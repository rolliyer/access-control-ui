import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import type {
  CreateRoleInput,
  PermissionRef,
  Role,
  RolePermission,
  UpdateRoleInput,
} from '@/types/access-control'

export const useRolesStore = defineStore('roles', () => {
  const api = useApi()

  const roles = ref<Role[]>([])
  const permissions = ref<RolePermission[]>([])

  const byId = computed(() => new Map(roles.value.map((r) => [r.roleId, r])))
  const sorted = computed(() =>
    [...roles.value].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.roleName.localeCompare(b.roleName),
    ),
  )
  const activeRoles = computed(() => sorted.value.filter((r) => r.isActive))

  const permissionsByRole = computed(() => {
    const map = new Map<string, RolePermission[]>()
    for (const p of permissions.value) {
      const list = map.get(p.roleId)
      if (list) list.push(p)
      else map.set(p.roleId, [p])
    }
    return map
  })

  function permissionsFor(roleId: string): RolePermission[] {
    return permissionsByRole.value.get(roleId) ?? []
  }

  async function fetchAll(): Promise<void> {
    const [roleRows, permissionRows] = await Promise.all([api.listRoles(), api.listPermissions()])
    roles.value = roleRows
    permissions.value = permissionRows
  }

  async function create(input: CreateRoleInput, initialPermissions: PermissionRef[] = []) {
    const role = await api.createRole(input)
    roles.value.push(role)
    if (initialPermissions.length) await setPermissions(role.roleId, initialPermissions)
    return role
  }

  async function update(roleId: string, patch: UpdateRoleInput): Promise<Role> {
    const updated = await api.updateRole(roleId, patch)
    const index = roles.value.findIndex((r) => r.roleId === roleId)
    if (index >= 0) roles.value[index] = updated
    return updated
  }

  function setActive(roleId: string, isActive: boolean): Promise<Role> {
    return update(roleId, { isActive })
  }

  async function setPermissions(roleId: string, refs: PermissionRef[]): Promise<void> {
    const rows = await api.setRolePermissions(roleId, refs)
    permissions.value = [...permissions.value.filter((p) => p.roleId !== roleId), ...rows]
  }

  return {
    roles,
    permissions,
    byId,
    sorted,
    activeRoles,
    permissionsByRole,
    permissionsFor,
    fetchAll,
    create,
    update,
    setActive,
    setPermissions,
  }
})
