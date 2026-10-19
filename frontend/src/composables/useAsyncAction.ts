import { ref, toValue } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'

export interface AsyncActionOptions {
  /** Toast shown on success; a getter is read when the action finishes. */
  successMessage?: string | (() => string)
  /** Show failures as a toast (default) or only expose them via `error`. */
  toastErrors?: boolean
}

/**
 * Wraps an async operation with `pending` / `error` state and toasts,
 * so components don't repeat try/catch/finally boilerplate.
 */
export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
  options: AsyncActionOptions = {},
) {
  const notifications = useNotificationsStore()
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function run(...args: Args): Promise<Result | undefined> {
    pending.value = true
    error.value = null
    try {
      const result = await action(...args)
      const message = toValue(options.successMessage)
      if (message) notifications.success(message)
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Something went wrong.'
      if (options.toastErrors !== false) notifications.error(error.value)
      return undefined
    } finally {
      pending.value = false
    }
  }

  return { run, pending, error }
}
