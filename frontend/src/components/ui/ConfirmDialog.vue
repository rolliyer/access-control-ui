<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

const open = defineModel<boolean>('open', { required: true })

const { confirmLabel = 'Confirm', variant = 'primary' } = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <BaseModal v-model:open="open" :title="title" size="sm">
    <p>{{ message }}</p>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
      <BaseButton :variant="variant" :loading @click="emit('confirm')">
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
