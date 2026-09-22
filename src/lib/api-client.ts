/**
 * Lightweight API client for the SPA. Throws on non-2xx with server message.
 */
export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body?: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; query?: Record<string, string | number | boolean | undefined | null>; signal?: AbortSignal },
): Promise<T> {
  let url = path
  if (opts?.query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, {
    method,
    headers: opts?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts?.signal,
    credentials: 'same-origin',
  })
  const text = await res.text().catch(() => '')
  let data: any = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && data.error) || res.statusText || 'Request failed'
    throw new ApiError(msg, res.status, data)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<Parameters<typeof request>[2], 'body'>) =>
    request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<Parameters<typeof request>[2], 'body'>) =>
    request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<Parameters<typeof request>[2], 'body'>) =>
    request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>('DELETE', path, opts),
}
