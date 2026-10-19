import { computed, reactive, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { DEFAULT_GRANT_DAYS } from '@/domain/grants'
import { validateGrantDates, validateGrantor, validateRequired } from '@/domain/validation'
import { addDays, fromDateInputValue, toDateInputValue } from '@/utils/date'

export interface GrantFormValues {
  startDate: string
  expiryDate: string
  grantedBy: string
  reason: string
}

export interface GrantTiming {
  grantedAt: string
  expiresAt: string | null
  grantedBy: string
  reason: string | null
}

/**
 * Shared grant details (start, expiry, approver, reason) with the guide's
 * rules: approver ≠ grantee, expiry after start, a reason is recorded.
 */
export function useGrantForm(granteeEmail: MaybeRefOrGetter<string>, defaultApprover = '') {
  const values = reactive<GrantFormValues>({
    startDate: '',
    expiryDate: '',
    grantedBy: '',
    reason: '',
  })
  const submitted = ref(false)

  function reset(approver = defaultApprover): void {
    const today = new Date()
    values.startDate = toDateInputValue(today)
    values.expiryDate = toDateInputValue(addDays(today, DEFAULT_GRANT_DAYS))
    values.grantedBy = approver
    values.reason = ''
    submitted.value = false
  }
  reset()

  const timing = computed(() => ({
    grantedAt: values.startDate ? fromDateInputValue(values.startDate) : '',
    expiresAt: values.expiryDate ? fromDateInputValue(values.expiryDate) : null,
  }))

  const allErrors = computed(() => ({
    startDate: validateRequired(values.startDate, 'Start date'),
    expiryDate: timing.value.grantedAt
      ? validateGrantDates(timing.value.grantedAt, timing.value.expiresAt)
      : null,
    grantedBy: validateGrantor(values.grantedBy, toValue(granteeEmail)),
    reason: validateRequired(values.reason, 'Reason'),
  }))

  const errors = computed(() =>
    submitted.value
      ? allErrors.value
      : { startDate: null, expiryDate: null, grantedBy: null, reason: null },
  )

  function validate(): boolean {
    submitted.value = true
    return Object.values(allErrors.value).every((e) => e === null)
  }

  function toTiming(): GrantTiming {
    return {
      ...timing.value,
      grantedBy: values.grantedBy.trim().toLowerCase(),
      reason: values.reason.trim() || null,
    }
  }

  return { values, errors, validate, toTiming, reset }
}
