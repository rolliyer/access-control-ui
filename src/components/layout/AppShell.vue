<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="shell">
    <aside class="shell__sidebar">
      <AppSidebar />
    </aside>
    <main class="shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.shell__sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
}

.shell__main {
  padding: var(--space-6);
  max-width: 1400px;
  width: 100%;
}

@media (max-width: 860px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .shell__sidebar {
    position: static;
    height: auto;
  }

  .shell__main {
    padding: var(--space-4);
  }
}
</style>
