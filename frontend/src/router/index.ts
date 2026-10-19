import { createRouter, createWebHistory } from 'vue-router'
import { RouteName } from './route-names'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

const APP_TITLE = 'Access Control · Roller Analytics'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: RouteName.Dashboard,
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'Dashboard' },
    },
    {
      path: '/users',
      name: RouteName.Users,
      component: () => import('@/views/UsersView.vue'),
      meta: { title: 'Users' },
    },
    {
      path: '/users/:userId',
      name: RouteName.UserDetail,
      component: () => import('@/views/UserDetailView.vue'),
      props: true,
      meta: { title: 'User' },
    },
    {
      path: '/roles',
      name: RouteName.Roles,
      component: () => import('@/views/RolesView.vue'),
      meta: { title: 'Roles & permissions' },
    },
    {
      path: '/domains',
      name: RouteName.Domains,
      component: () => import('@/views/DomainsView.vue'),
      meta: { title: 'Domains' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: RouteName.NotFound,
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: 'Not found' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_TITLE}` : APP_TITLE
})

export { RouteName }
export default router
