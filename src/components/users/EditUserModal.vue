<script setup lang="ts">
import { watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import UserFormFields from './UserFormFields.vue'
import { useUserForm } from '@/composables/useUserForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useUsersStore } from '@/stores/users'
import type { User } from '@/types/access-control'

const open = defineModel<boolean>('open', { required: true })
const { user } = defineProps<{ user: User }>()

const usersStore = useUsersStore()
const form = useUserForm(user)

watch(open, (isOpen) => {
  if (isOpen) form.reset(user)
})

const { run: save, pending } = useAsyncAction(
  () => usersStore.update(user.userId, form.toInput()),
  { successMessage: 'User updated.' },
)

async function submit(): Promise<void> {
  if (!form.validate()) return
  if (await save()) open.value = false
}
</script>

<template>
  <BaseModal v-model:open="open" title="Edit user">
    <form id="edit-user-form" novalidate @submit.prevent="submit">
      <UserFormFields
        v-model:email="form.values.email"
        v-model:first-name="form.values.firstName"
        v-model:last-name="form.values.lastName"
        v-model:department="form.values.department"
        :errors="form.errors.value"
        :departments="usersStore.departments"
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton type="submit" form="edit-user-form" :loading="pending">Save changes</BaseButton>
    </template>
  </BaseModal>
</template>
