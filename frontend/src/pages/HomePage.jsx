import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSubjects } from '../lib/bookApi.js'

// Emoji icons keyed by subject name (case-insensitive partial match)
const SUBJECT_ICONS = {
  math: '📐',
  science: '🔬',
  english: '📖',
  social: '🌍',
  history: '🏛️',
  geography: '🗺️',
  computer: '💻',
  hindi: '📝',
  physics: '⚛️',
  chemistry: '🧪',
  biology: '🧬',
  default: '📚',
}

// Accent colours cycling for cards
const ACCENTS = ['blue', 'green', 'rose', 'amber', 'violet', 'teal']

function getIcon(subjectName) {
  const lower = subjectName.toLowerCase()
  for (const [key, icon] of Object.entries(SUBJECT_ICONS)) {
    if (key !== 'default' && lower.includes(key)) return icon
  }
  return SUBJECT_ICONS.default
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function SubjectDashboard({ user }) {
  const firstName = user?.name?.split(' ')[0] ?? 'Student'
  const standard = user?.standard

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    fetchSubjects()
      .then((data) => {
        if (!cancelled) setSubjects(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="page-section home-page dashboard-page">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Your study space</span>
          <h2>
            {getGreeting()}, {firstName}! 👋
          </h2>
          <p>
            {standard ? `Class ${standard} • ` : ''}
            {loading
              ? 'Loading your subjects…'
              : error
                ? 'Could not load subjects.'
                : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''} available for you.`}
          </p>
        </div>

        {!loading && !error && (
          <div className="dashboard-summary" aria-label="Dashboard summary">
            <span>Available subjects</span>
            <strong>{subjects.length}</strong>
          </div>
        )}
      </div>

      {loading && (
        <div className="subjects-loading" aria-live="polite">
          {[...Array(3)].map((_, i) => (
            <div className="subject-card subject-skeleton" key={i} aria-hidden="true" />
          ))}
        </div>
      )}

      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && subjects.length === 0 && (
        <p className="subjects-empty">
          No subjects found for Class {standard} yet. Ask your teacher to upload books.
        </p>
      )}

      {!loading && !error && subjects.length > 0 && (
        <div className="subject-grid" aria-label="Available subjects">
          {subjects.map((subject, index) => (
            <article
              className={`subject-card subject-card-${ACCENTS[index % ACCENTS.length]}`}
              key={subject.id}
            >
              <div className="subject-card-top">
                <span className="subject-icon">{getIcon(subject.subject)}</span>
                <span className="lesson-count">Class {subject.standard}</span>
              </div>
              <h3>{subject.subject}</h3>
              <p>Tap below to open the textbook PDF for this subject.</p>
              <a
                href={subject.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="subject-action"
                id={`open-subject-${subject.id}`}
              >
                Open textbook →
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePage({ isAuthenticated, user }) {
  if (isAuthenticated) {
    return <SubjectDashboard user={user} />
  }

  return (
    <section className="page-section home-page">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Study smarter</span>
          <h2>Your personal AI-powered textbook tutor.</h2>
          <p>
            BookHelp gives you instant explanations, chapter summaries, and practice
            questions — all personalised to your class and subject.
          </p>

          <div className="hero-actions">
            <Link className="button button-primary" to="/register" id="hero-register-btn">
              Get started free
            </Link>
            <Link className="button button-secondary" to="/login" id="hero-login-btn">
              Login
            </Link>
          </div>
        </div>

        <div className="feature-card">
          <p className="feature-label">What you get</p>
          <ul>
            <li>📚 Instant chapter explanations</li>
            <li>✏️ Practice questions with hints</li>
            <li>🧪 Science, Math, English &amp; more</li>
            <li>🔒 Secure login, saved sessions</li>
          </ul>
        </div>
      </div>

      <div className="info-grid">
        <article className="info-card">
          <h3>All subjects covered</h3>
          <p>From Algebra to History — clear explanations for every chapter in your textbook.</p>
        </article>
        <article className="info-card">
          <h3>Class-specific content</h3>
          <p>Content is filtered by your class so you only see what's relevant to you.</p>
        </article>
        <article className="info-card">
          <h3>Anytime, anywhere</h3>
          <p>Study at your own pace. Bookmark topics and pick up right where you left off.</p>
        </article>
      </div>
    </section>
  )
}
