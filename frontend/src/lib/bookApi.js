import { getAuthHeaders } from './authApi.js'

const API_BASE = ''

/**
 * Fetches all subjects available for the logged-in user's standard.
 * GET /books/subjects — requires Bearer token.
 * @returns {Promise<{ id: number, subject: string, pdf_url: string, standard: number }[]>}
 */
export async function fetchSubjects() {
  const response = await fetch(`${API_BASE}/books/subjects`, {
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Failed to load subjects')
  }

  return payload.subjects
}
