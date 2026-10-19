<script setup lang="ts">
import BaseInput from '@/components/ui/BaseInput.vue'
import { EMAIL_DOMAIN } from '@/domain/validation'

const email = defineModel<string>('email', { required: true })
const firstName = defineModel<string>('firstName', { required: true })
const lastName = defineModel<string>('lastName', { required: true })
const department = defineModel<string>('department', { required: true })

defineProps<{
  errors: { email: string | null; firstName: string | null; lastName: string | null }
  departments?: readonly string[]
}>()
</script>

<template>
  <div class="user-fields">
    <BaseInput
      v-model="firstName"
      label="First name"
      autocomplete="off"
      required
      :error="errors.firstName"
    />
    <BaseInput
      v-model="lastName"
      label="Last name"
      autocomplete="off"
      required
      :error="errors.lastName"
    />
    <BaseInput
      v-model="email"
      class="user-fields__wide"
      label="Work email"
      type="email"
      :placeholder="`first.last${EMAIL_DOMAIN}`"
      hint="Must match exactly how they sign in to Microsoft. Saved in lowercase."
      autocomplete="off"
      required
      :error="errors.email"
    />
    <div class="user-fields__wide">
      <BaseInput
        v-model="department"
        label="Department"
        hint="For information only — it never decides access."
        list="department-options"
      />
      <datalist id="department-options">
        <option v-for="d in departments" :key="d" :value="d" />
      </datalist>
    </div>
  </div>
</template>

<style scoped>
.user-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.user-fields__wide {
  grid-column: 1 / -1;
}

@media (max-width: 560px) {
  .user-fields {
    grid-template-columns: 1fr;
  }
}
</style>
