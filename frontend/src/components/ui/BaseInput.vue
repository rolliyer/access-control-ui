<script setup lang="ts">
import { useId } from 'vue'
import FormField from './FormField.vue'

const model = defineModel<string>({ default: '' })

const {
  label,
  type = 'text',
  multiline = false,
} = defineProps<{
  label: string
  type?: 'text' | 'email' | 'date' | 'search'
  placeholder?: string
  hint?: string
  error?: string | null
  required?: boolean
  multiline?: boolean
  autocomplete?: string
  min?: string
  /** id of a <datalist> with suggestions */
  list?: string
  readonly?: boolean
}>()

const id = useId()
</script>

<template>
  <FormField :id="id" v-slot="{ describedBy }" :label="label" :hint :error :required>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      class="control"
      rows="3"
      :placeholder
      :required
      :aria-invalid="Boolean(error)"
      :aria-describedby="describedBy"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      class="control"
      :type
      :placeholder
      :required
      :autocomplete
      :min
      :list
      :readonly
      :aria-invalid="Boolean(error)"
      :aria-describedby="describedBy"
    />
  </FormField>
</template>
