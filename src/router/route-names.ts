export const RouteName = {
  Dashboard: 'dashboard',
  Users: 'users',
  UserDetail: 'user-detail',
  Roles: 'roles',
  Domains: 'domains',
  NotFound: 'not-found',
} as const

export type RouteName = (typeof RouteName)[keyof typeof RouteName]
