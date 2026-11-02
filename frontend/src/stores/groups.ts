import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/api'
import { useUsersStore } from './users'
import type {
  AddGroupMemberInput,
  AddGroupMembersInput,
  AddGroupMembersResult,
  CreateGroupInput,
  Group,
  GroupMember,
  GroupRole,
  UpdateGroupInput,
} from '@/types/access-control'
import {
  isExpiringSoon,
  isMembershipActive,
  isMembershipOpen,
  membershipWindow,
} from '@/domain/grants'

export const useGroupsStore = defineStore('groups', () => {
  const api = useApi()

  const groups = ref<Group[]>([])
  const members = ref<GroupMember[]>([])
  const groupRoles = ref<GroupRole[]>([])

  const byId = computed(() => new Map(groups.value.map((g) => [g.groupId, g])))
  const sorted = computed(() =>
    [...groups.value].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.groupName.localeCompare(b.groupName),
    ),
  )
  const activeGroups = computed(() => sorted.value.filter((g) => g.isActive))

  const activeMemberships = computed(() => members.value.filter((m) => isMembershipActive(m)))
  const expiringSoon = computed(() =>
    members.value
      .filter((m) => isExpiringSoon(membershipWindow(m)))
      .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '')),
  )

  function membersOf(groupId: string): GroupMember[] {
    return members.value.filter((m) => m.groupId === groupId)
  }

  function membershipsOf(userId: string): GroupMember[] {
    return members.value.filter((m) => m.userId === userId)
  }

  /** Roles the group currently gives its members. */
  function rolesOf(groupId: string): GroupRole[] {
    return groupRoles.value.filter((gr) => gr.groupId === groupId && !gr.revokedAt)
  }

  function activeMemberCount(groupId: string): number {
    return activeMemberships.value.filter((m) => m.groupId === groupId).length
  }

  /** Groups the user is in now or will be (so they can't be added twice). */
  function openGroupIdsOf(userId: string): Set<string> {
    return new Set(
      members.value.filter((m) => m.userId === userId && isMembershipOpen(m)).map((m) => m.groupId),
    )
  }

  async function fetchAll(): Promise<void> {
    const [groupRows, memberRows, roleRows] = await Promise.all([
      api.listGroups(),
      api.listGroupMembers(),
      api.listGroupRoles(),
    ])
    groups.value = groupRows
    members.value = memberRows
    groupRoles.value = roleRows
  }

  async function create(input: CreateGroupInput, roleIds: string[] = []): Promise<Group> {
    const group = await api.createGroup(input)
    groups.value.push(group)
    for (const roleId of roleIds) await addRole(group.groupId, roleId)
    return group
  }

  async function update(groupId: string, patch: UpdateGroupInput): Promise<Group> {
    const updated = await api.updateGroup(groupId, patch)
    replace(groups.value, (g) => g.groupId === groupId, updated)
    return updated
  }

  async function addMember(groupId: string, input: AddGroupMemberInput): Promise<GroupMember> {
    const member = await api.addGroupMember(groupId, input)
    members.value.push(member)
    return member
  }

  async function addMembers(
    groupId: string,
    input: AddGroupMembersInput,
  ): Promise<AddGroupMembersResult> {
    const result = await api.addGroupMembers(groupId, input)
    useUsersStore().users.push(...result.createdUsers)
    members.value.push(...result.added)
    return result
  }

  async function removeMember(groupMemberId: string): Promise<GroupMember> {
    const updated = await api.removeGroupMember(groupMemberId)
    replace(members.value, (m) => m.groupMemberId === groupMemberId, updated)
    return updated
  }

  async function addRole(groupId: string, roleId: string, reason: string | null = null) {
    const groupRole = await api.addGroupRole(groupId, { roleId, reason })
    groupRoles.value.push(groupRole)
    return groupRole
  }

  async function revokeRole(groupRoleId: string): Promise<GroupRole> {
    const updated = await api.revokeGroupRole(groupRoleId)
    replace(groupRoles.value, (gr) => gr.groupRoleId === groupRoleId, updated)
    return updated
  }

  return {
    groups,
    members,
    groupRoles,
    byId,
    sorted,
    activeGroups,
    activeMemberships,
    expiringSoon,
    membersOf,
    membershipsOf,
    rolesOf,
    activeMemberCount,
    openGroupIdsOf,
    fetchAll,
    create,
    update,
    addMember,
    addMembers,
    removeMember,
    addRole,
    revokeRole,
  }
})

function replace<T>(list: T[], match: (item: T) => boolean, value: T): void {
  const index = list.findIndex(match)
  if (index >= 0) list[index] = value
}
