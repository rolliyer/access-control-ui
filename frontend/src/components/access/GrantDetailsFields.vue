<script setup lang="ts">
import BaseInput from '@/components/ui/BaseInput.vue'
import { DEFAULT_GRANT_DAYS } from '@/domain/grants'

const startDate = defineModel<string>('startDate', { required: true })
const expiryDate = defineModel<string>('expiryDate', { required: true })
const grantedBy = defineModel<string>('grantedBy', { required: true })
const reason = defineModel<string>('reason', { required: true })

defineProps<{
  errors: {
    startDate: string | null
    expiryDate: string | null
    grantedBy: string | null
    reason: string | null
  }
}>()
</script>

<template>
  <div class="grant-fields">
    <BaseInput
      v-model="startDate"
      label="Access starts"
      type="date"
      required
      :error="errors.startDate"
    />
    <BaseInput
      v-model="expiryDate"
      label="Access expires"
      type="date"
      :min="startDate"
      :hint="`Defaults to ${DEFAULT_GRANT_DAYS} days. Expiry keeps access clean.`"
      :error="errors.expiryDate"
    />
    <BaseInput
      v-model="grantedBy"
      class="grant-fields__wide"
      label="Approved by"
      type="email"
      hint="The approver's email — never the person receiving access."
      required
      :error="errors.grantedBy"
    />
    <BaseInput
      v-model="reason"
      class="grant-fields__wide"
      label="Reason"
      placeholder="e.g. Joined the support team"
      required
      :error="errors.reason"
    />
  </div>
</template>

<style scoped>
.grant-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.grant-fields__wide {
  grid-column: 1 / -1;
}

@media (max-width: 560px) {
  .grant-fields {
    grid-template-columns: 1fr;
  }
}
</style>
