<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/types/access-control'
import { initials } from '@/utils/user'

const { user, size = 'md' } = defineProps<{
  user: Pick<User, 'firstName' | 'lastName' | 'email' | 'isActive'>
  size?: 'sm' | 'md' | 'lg'
}>()

const text = computed(() => initials(user))
</script>

<template>
  <span
    class="avatar"
    :class="[`avatar--${size}`, { 'is-inactive': !user.isActive }]"
    aria-hidden="true"
  >
    {{ text }}
  </span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-accent-strong);
  color: var(--color-text-inverse);
  font-weight: 700;
}

.avatar.is-inactive {
  background: var(--color-mark-empty);
  color: var(--color-text);
}

.avatar--sm {
  width: 30px;
  height: 30px;
  font-size: var(--text-xs);
}

.avatar--md {
  width: 38px;
  height: 38px;
  font-size: var(--text-sm);
}

.avatar--lg {
  width: 64px;
  height: 64px;
  font-size: var(--text-xl);
}
</style>
