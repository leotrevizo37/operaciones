import type { Csrf } from './types'

let csrf: Csrf | null = null

export async function ensureCsrf(): Promise<Csrf> {
  if (csrf) return csrf
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!response.ok) throw new Error('csrf_unavailable')
  csrf = (await response.json()) as Csrf
  return csrf
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.method && init.method !== 'GET' && init.method !== 'HEAD') {
    const token = await ensureCsrf()
    headers.set(token.headerName, token.token)
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  if (!response.ok) {
    const error = new Error(`api_${response.status}`)
    Object.assign(error, { status: response.status })
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function clearCsrf() {
  csrf = null
}
