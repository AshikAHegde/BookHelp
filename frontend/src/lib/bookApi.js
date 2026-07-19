import { getAuthHeaders } from './authApi.js'

const API_BASE = ''

async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Fetches all subjects available for the logged-in user's standard.
 * GET /books/subjects — requires Bearer token.
 * @returns {Promise<{ id: number, subject: string, pdf_url: string, standard: number }[]>}
 */
export async function fetchSubjects() {
  const response = await fetch(`${API_BASE}/books/subjects`, {
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  })

  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Failed to load subjects')
  }

  return payload.subjects
}

export async function askQuestion({ query, history = [], standard, subject, topK = 5 }) {
  const response = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      query,
      history,
      standard,
      subject,
      topK,
    }),
  })

  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Failed to get answer')
  }

  return payload
}
