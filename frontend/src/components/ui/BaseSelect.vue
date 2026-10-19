<script setup lang="ts">
import { useId } from 'vue'
import FormField from './FormField.vue'
import type { SelectOption } from './types'

const model = defineModel<string>({ default: '' })

defineProps<{
  label: string
  options: readonly SelectOption[]
  placeholder?: string
  hint?: string
  error?: string | null
  required?: boolean
}>()

const id = useId()
</script>

<template>
  <FormField :id="id" v-slot="{ describedBy }" :label="label" :hint :error :required>
    <select
      :id="id"
      v-model="model"
      class="control"
      :required
      :aria-invalid="Boolean(error)"
      :aria-describedby="describedBy"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  </FormField>
</template>
