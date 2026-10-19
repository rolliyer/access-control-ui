<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import AppShell from '@/components/layout/AppShell.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useAccessStore } from '@/stores/access'

const access = useAccessStore()
const { loading, loaded, error } = storeToRefs(access)

onMounted(() => access.loadAll())
</script>

<template>
  <AppShell>
    <EmptyState v-if="error && !loaded" title="Couldn't load access data" :message="error">
      <BaseButton :loading="loading" @click="access.loadAll()">Try again</BaseButton>
    </EmptyState>
    <div v-else-if="!loaded" class="app-loading" role="status">Loading access data…</div>
    <RouterView v-else />
  </AppShell>
  <ToastContainer />
</template>

<style scoped>
.app-loading {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-muted);
}
</style>
