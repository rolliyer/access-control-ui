<script setup lang="ts">
import RollerLogo from '@/components/ui/RollerLogo.vue'
import { RouteName } from '@/router/route-names'
import { appConfig } from '@/config'

const links = [
  {
    to: { name: RouteName.Dashboard },
    label: 'Dashboard',
    icon: 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z',
  },
  {
    to: { name: RouteName.Users },
    label: 'Users',
    icon: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 0a2.5 2.5 0 1 0 0-5M1 17c0-3 3-5 6-5s6 2 6 5M14 12c2 0 5 1.5 5 4.5',
  },
  {
    to: { name: RouteName.Roles },
    label: 'Roles & permissions',
    icon: 'M10 2 3 5v5c0 4 3 7 7 8 4-1 7-4 7-8V5zM7 10l2 2 4-4',
  },
  {
    to: { name: RouteName.Domains },
    label: 'Domains',
    icon: 'M2 5h6l2 2h8v9H2zM2 5v11',
  },
] as const
</script>

<template>
  <nav class="sidebar" aria-label="Main">
    <RouterLink :to="{ name: RouteName.Dashboard }" class="sidebar__brand">
      <RollerLogo :size="32" />
      <span>
        <strong>Access Control</strong>
        <small>Roller Analytics Agent</small>
      </span>
    </RouterLink>

    <ul class="sidebar__links">
      <li v-for="link in links" :key="link.label">
        <RouterLink :to="link.to" class="sidebar__link" active-class="is-active">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              :d="link.icon"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          {{ link.label }}
        </RouterLink>
      </li>
    </ul>

    <div class="sidebar__footer">
      <span class="sidebar__mode" :title="appConfig.apiBaseUrl">
        {{ appConfig.apiMode === 'mock' ? 'Mock data' : 'Live API' }}
      </span>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  height: 100%;
  padding: var(--space-5) var(--space-3);
  background: var(--color-sidebar);
  color: var(--color-sidebar-text);
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-2);
  color: var(--color-sidebar-text);
}

.sidebar__brand:hover {
  color: var(--color-sidebar-text);
  text-decoration: none;
}

.sidebar__brand strong {
  display: block;
  font-size: var(--text-md);
}

.sidebar__brand small {
  display: block;
  font-size: var(--text-xs);
  opacity: 0.75;
}

.sidebar__links {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-sidebar-text);
  font-weight: 700;
  opacity: 0.8;
}

.sidebar__link svg {
  width: 18px;
  height: 18px;
}

.sidebar__link:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text);
  text-decoration: none;
  opacity: 1;
}

.sidebar__link.is-active {
  background: var(--color-sidebar-active);
  box-shadow: inset 3px 0 0 var(--color-sidebar-indicator);
  opacity: 1;
}

.sidebar__footer {
  margin-top: auto;
  padding: 0 var(--space-2);
}

.sidebar__mode {
  display: inline-block;
  padding: 2px var(--space-2);
  border: 1px solid var(--color-sidebar-outline);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

@media (max-width: 860px) {
  .sidebar {
    flex-direction: row;
    align-items: center;
    height: auto;
    padding: var(--space-3) var(--space-4);
    overflow-x: auto;
  }

  .sidebar__brand small,
  .sidebar__footer {
    display: none;
  }

  .sidebar__links {
    flex-direction: row;
  }

  .sidebar__link {
    white-space: nowrap;
  }
}
</style>
