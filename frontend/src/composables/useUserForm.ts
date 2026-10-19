import { computed, reactive, ref } from 'vue'
import type { CreateUserInput, User } from '@/types/access-control'
import { normalizeEmail, validateEmail, validateRequired } from '@/domain/validation'

export interface UserFormValues {
  email: string
  firstName: string
  lastName: string
  department: string
}

/** Form state + validation for creating or editing a user. */
export function useUserForm(initial?: Partial<User>) {
  const values = reactive<UserFormValues>({
    email: '',
    firstName: '',
    lastName: '',
    department: '',
  })
  const submitted = ref(false)

  function reset(from?: Partial<User>): void {
    values.email = from?.email ?? ''
    values.firstName = from?.firstName ?? ''
    values.lastName = from?.lastName ?? ''
    values.department = from?.department ?? ''
    submitted.value = false
  }
  reset(initial)

  const allErrors = computed(() => ({
    email: validateEmail(values.email),
    firstName: validateRequired(values.firstName, 'First name'),
    lastName: validateRequired(values.lastName, 'Last name'),
  }))

  /** Errors are only shown after the first submit attempt. */
  const errors = computed(() =>
    submitted.value ? allErrors.value : { email: null, firstName: null, lastName: null },
  )

  function validate(): boolean {
    submitted.value = true
    return Object.values(allErrors.value).every((e) => e === null)
  }

  function toInput(): CreateUserInput {
    return {
      email: normalizeEmail(values.email),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      department: values.department.trim() || null,
    }
  }

  return { values, errors, validate, toInput, reset }
}
