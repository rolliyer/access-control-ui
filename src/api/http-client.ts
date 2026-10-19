import { ApiError } from './access-control-api'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface HttpClient {
  request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T>
}

/** Minimal JSON fetch wrapper. Sends cookies so the backend can identify the admin. */
export function createHttpClient(baseUrl: string): HttpClient {
  const root = baseUrl.replace(/\/+$/, '')

  return {
    async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
      const response = await fetch(`${root}${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (!response.ok) {
        throw new ApiError(await readErrorMessage(response), response.status)
      }
      return (response.status === 204 ? undefined : await response.json()) as T
    },
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; detail?: string }
    return data.message ?? data.detail ?? response.statusText
  } catch {
    return response.statusText || `Request failed (${response.status})`
  }
}
