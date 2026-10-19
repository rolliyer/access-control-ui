<script setup lang="ts">
import { useId } from 'vue'

/** The Roller chevron mark, traced from the official icon. */
const { size = 32, title } = defineProps<{
  size?: number
  /** Accessible name; omit when the mark is decorative. */
  title?: string
}>()

const gradientId = useId()
</script>

<template>
  <svg
    class="roller-logo"
    viewBox="0 0 390 447"
    :width="size * (390 / 447)"
    :height="size"
    :role="title ? 'img' : undefined"
    :aria-label="title"
    :aria-hidden="title ? undefined : 'true'"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="1" x2="1" y2="0.6">
        <stop offset="0" stop-color="#ff290c" />
        <stop offset="1" stop-color="#c91b06" />
      </linearGradient>
    </defs>
    <!-- Lower fold, in shadow -->
    <polygon points="130,223 260,447 0,447" :fill="`url(#${gradientId})`" />
    <!-- Main chevron -->
    <polygon points="0,0 260,0 390,223 260,447 130,223" fill="#ff290c" />
  </svg>
</template>

<style scoped>
.roller-logo {
  display: block;
  flex-shrink: 0;
}
</style>
