import type { AccessControlApi } from './access-control-api'
import { HttpAccessControlApi } from './adapters/http-adapter'
import { MockAccessControlApi } from './adapters/mock-adapter'
import { createHttpClient } from './http-client'
import { appConfig } from '@/config'

export type { AccessControlApi } from './access-control-api'
export { ApiError } from './access-control-api'

let instance: AccessControlApi | null = null

function createApi(): AccessControlApi {
  if (appConfig.apiMode === 'http') {
    return new HttpAccessControlApi(createHttpClient(appConfig.apiBaseUrl))
  }
  return new MockAccessControlApi({ actorEmail: appConfig.actorEmail })
}

/** The app-wide API client, chosen by `VITE_API_MODE`. */
export function useApi(): AccessControlApi {
  return (instance ??= createApi())
}

/** Swap the implementation (tests, storybook-style previews). */
export function setApi(api: AccessControlApi | null): void {
  instance = api
}
