import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DISMISS_AFTER_MS = 4000

export const useNotificationsStore = defineStore('notifications', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function push(kind: ToastKind, message: string): void {
    const id = nextId++
    toasts.value.push({ id, kind, message })
    setTimeout(() => dismiss(id), kind === 'error' ? DISMISS_AFTER_MS * 2 : DISMISS_AFTER_MS)
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
})
