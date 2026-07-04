const API_BASE = ''
const AUTH_TOKEN_KEY = 'bookhelp_auth_token'
const AUTH_USER_KEY = 'bookhelp_auth_user'
let authToken = localStorage.getItem(AUTH_TOKEN_KEY)
let authUser = (() => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

/**
 * Extracts a readable message from a backend response payload.
 * @param {unknown} payload Response body returned by the backend.
 * @returns {string} Human-friendly error message.
 */
function getErrorMessage(payload) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return 'Something went wrong. Please try again.'
}

/**
 * Reads the stored JWT from memory.
 * @returns {string | null} Stored token if present.
 */
function getAuthToken() {
  return authToken
}

/**
 * Reads the stored user profile from memory.
 * @returns {{ id: number, name: string, email: string, standard: number } | null}
 */
export function getAuthUser() {
  return authUser
}

/**
 * Builds request headers and attaches the Bearer token when available.
 * @param {HeadersInit} [extraHeaders={}] Additional headers to merge.
 * @returns {HeadersInit} Final headers object.
 */
export function getAuthHeaders(extraHeaders = {}) {
  const token = getAuthToken()

  if (!token) {
    return extraHeaders
  }

  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Sends a JSON request and attaches the JWT when present.
 * @param {string} path API path to call.
 * @param {RequestInit} [options={}] Fetch options.
 * @returns {Promise<any>} Parsed response payload.
 */
async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }),
  })

  const responseText = await response.text()
  const payload = responseText ? JSON.parse(responseText) : null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload))
  }

  return payload
}

/**
 * Sends a JSON request to the backend auth routes.
 * @param {string} path Request path under the auth API.
 * @param {Record<string, unknown>} body Request body to submit.
 * @returns {Promise<{ success: boolean, message: string, user?: object, token?: string }>}
 */
async function sendAuthRequest(path, body) {
  return fetchJson(`/auth${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Sends a login request to the backend.
 * @param {{ email: string, password: string }} credentials Login credentials.
 * @returns {Promise<object>} Backend response payload.
 */
export function loginUser(credentials) {
  return sendAuthRequest('/login', credentials)
}

/**
 * Sends a registration request to the backend.
 * @param {{ name: string, email: string, password: string, standard: string }} details Registration details.
 * @returns {Promise<object>} Backend response payload.
 */
export function registerUser(details) {
  return sendAuthRequest('/register', details)
}

/**
 * Stores the JWT in memory for request headers.
 * @param {string | null} token JWT returned by the backend.
 * @returns {void}
 */
/**
 * Stores the JWT and user profile together.
 * @param {string | null} token JWT returned by the backend.
 * @param {{ id: number, name: string, email: string, standard: number } | null} [user]
 * @returns {void}
 */
export function setAuthToken(token, user = null) {
  authToken = token
  authUser = user

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    return
  }

  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

/**
 * Returns whether a JWT is currently stored.
 * @returns {boolean} True when the user has a stored token.
 */
export function hasAuthToken() {
  return Boolean(getAuthToken())
}
