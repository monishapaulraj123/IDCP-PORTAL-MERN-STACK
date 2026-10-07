// Thin fetch wrapper for talking to the IDCP backend. Centralizing this
// here means every page/context gets consistent base-URL handling, JWT
// attachment, and error parsing instead of re-implementing fetch() calls.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const TOKEN_STORAGE_KEY = 'idcp_token'

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

// Fired whenever a request comes back 401, so AuthContext can log the
// user out globally (e.g. expired session) no matter which page/hook
// triggered the request.
let onUnauthorized = () => {}
export function setOnUnauthorized(fn) {
  onUnauthorized = fn
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // Some responses (e.g. 204) have no body — that's fine.
  }

  if (res.status === 401) {
    onUnauthorized()
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`
    const error = new Error(message)
    error.status = res.status
    error.fields = data?.fields
    throw error
  }

  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' })
}

export default api
