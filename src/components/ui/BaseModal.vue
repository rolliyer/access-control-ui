<script setup lang="ts">
import { nextTick, onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'

const open = defineModel<boolean>('open', { required: true })

const { size = 'md' } = defineProps<{
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const titleId = useId()
const dialog = useTemplateRef<HTMLElement>('dialog')
let previouslyFocused: HTMLElement | null = null

function close(): void {
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(
  open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
      await nextTick()
      const firstField = dialog.value?.querySelector<HTMLElement>('input, select, textarea, button')
      firstField?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @mousedown.self="close">
        <div
          ref="dialog"
          class="modal"
          :class="`modal--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <header class="modal__header">
            <div>
              <h2 :id="titleId" class="modal__title">{{ title }}</h2>
              <p v-if="description" class="modal__description">{{ description }}</p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" @click="close">×</button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh var(--space-4) var(--space-4);
  background: var(--color-overlay);
  overflow-y: auto;
}

.modal {
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal--sm {
  max-width: 420px;
}

.modal--md {
  max-width: 560px;
}

.modal--lg {
  max-width: 760px;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-3);
}

.modal__title {
  font-size: var(--text-lg);
}

.modal__description {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
}

.modal__close {
  border: none;
  background: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
}

.modal__body {
  padding: var(--space-3) var(--space-5) var(--space-5);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
