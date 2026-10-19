<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { RouteName } from '@/router/route-names'
</script>

<template>
  <EmptyState title="Page not found" message="The page you're looking for doesn't exist.">
    <BaseButton :to="{ name: RouteName.Dashboard }">Go to dashboard</BaseButton>
  </EmptyState>
</template>
