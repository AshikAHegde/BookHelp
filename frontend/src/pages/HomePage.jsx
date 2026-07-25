import { motion } from 'framer-motion'
import { ArrowRight, BookOpenText, RotateCcw, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSubjects } from '../lib/bookApi.js'

const SUBJECT_ICONS = {
  math: BookOpenText,
  science: Sparkles,
  english: Search,
  social: BookOpenText,
  history: BookOpenText,
  geography: BookOpenText,
  computer: BookOpenText,
  hindi: BookOpenText,
  physics: Sparkles,
  chemistry: Sparkles,
  biology: Sparkles,
  default: BookOpenText,
}

function getIcon(subjectName = '') {
  const lower = subjectName.toLowerCase()
  const iconKey = Object.keys(SUBJECT_ICONS).find(
    (key) => key !== 'default' && lower.includes(key)
  )

  return SUBJECT_ICONS[iconKey || 'default']
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark">
        <Sparkles size={18} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function LandingPage() {
  return (
    <section className="landing-shell">
      <motion.div
        className="landing-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="landing-copy">
          <span className="eyebrow">BookHelp</span>
          <h1>Textbook study, redesigned as a calm premium workspace.</h1>
          <p>
            Ask questions from your books, jump back into subjects instantly, and keep every study
            session focused. No clutter, no fake dashboards, just the real workflow.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="button button-primary">
              Get started
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="button button-secondary">
              Log in
            </Link>
          </div>

          <div className="landing-points">
            <span>Textbook-grounded answers</span>
            <span>Saved sessions</span>
            <span>Clean mobile layout</span>
          </div>
        </div>

        <div className="landing-preview premium-surface">
          <div className="preview-header">
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="preview-dot" />
          </div>

          <div className="preview-panel">
            <div>
              <span className="eyebrow">Functional surfaces</span>
              <h2>Subjects, search, and textbook chat in one place.</h2>
            </div>

            <div className="preview-list">
              <article>
                <BookOpenText size={18} />
                <div>
                  <strong>Library</strong>
                  <p>Open the subjects available for your class.</p>
                </div>
              </article>
              <article>
                <Search size={18} />
                <div>
                  <strong>Search</strong>
                  <p>Filter by subject name or PDF link instantly.</p>
                </div>
              </article>
              <article>
                <RotateCcw size={18} />
                <div>
                  <strong>Conversation</strong>
                  <p>Keep asking follow-up questions with citations.</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function DashboardView({ user, query, onQueryChange }) {
  const firstName = user?.name?.split(' ')[0] ?? 'Student'
  const standard = user?.standard
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadSubjects() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchSubjects()
        if (!cancelled) setSubjects(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load subjects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSubjects()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const filteredSubjects = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return subjects

    return subjects.filter((subject) =>
      [subject.subject, subject.standard, subject.pdf_url]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [query, subjects])

  function clearSearch() {
    onQueryChange('')
  }

  return (
    <section className="dashboard-page">
      <motion.header
        className="page-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div className="page-hero-copy">
          <span className="eyebrow">Study library</span>
          <h1>
            {getGreeting()}, {firstName}
          </h1>
          <p>
            {standard ? `Class ${standard} · ` : ''}
            {loading
              ? 'Loading your available subjects.'
              : error
                ? 'We could not load your library right now.'
                : `${subjects.length} subject${subjects.length === 1 ? '' : 's'} ready for you.`}
          </p>
        </div>

        <div className="page-hero-actions">
          {query ? (
            <button type="button" className="button button-secondary" onClick={clearSearch}>
              Clear search
            </button>
          ) : null}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Refresh
          </button>
        </div>
      </motion.header>

      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="section-card" id="subjects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Subjects</span>
                <h2>Open a textbook</h2>
              </div>
              <span className="section-meta">
                {loading ? 'Loading' : `${filteredSubjects.length} visible`}
              </span>
            </div>

            {loading ? (
              <div className="subject-grid subject-grid-loading" aria-live="polite">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="subject-skeleton" key={index} aria-hidden="true" />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                title="Could not load subjects"
                description={error}
                action={
                  <button type="button" className="button button-primary" onClick={() => setReloadKey((value) => value + 1)}>
                    Retry
                  </button>
                }
              />
            ) : filteredSubjects.length === 0 ? (
              <EmptyState
                title="No subjects match your search"
                description="Try a different keyword or clear the filter."
                action={
                  <button type="button" className="button button-secondary" onClick={clearSearch}>
                    Clear search
                  </button>
                }
              />
            ) : (
              <div className="subject-grid">
                {filteredSubjects.map((subject) => {
                  const Icon = getIcon(subject.subject)
                  return (
                    <motion.article
                      className="subject-card"
                      key={subject.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <div className="subject-card-top">
                        <div className="subject-icon-wrap">
                          <Icon size={18} />
                        </div>
                        <span className="chip">Class {subject.standard}</span>
                      </div>

                      <div className="subject-card-copy">
                        <h3>{subject.subject}</h3>
                        <p>Open the textbook and continue from the last question.</p>
                      </div>

                      <div className="subject-card-footer">
                        <span>{subject.pdf_url ? 'PDF available' : 'No PDF link'}</span>
                        <Link
                          to={`/book/${subject.id}`}
                          state={{
                            pdf_url: subject.pdf_url,
                            subject: subject.subject,
                            standard: subject.standard,
                          }}
                          className="button button-primary button-inline"
                        >
                          Open textbook
                        </Link>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="dashboard-sidebar">
          <section className="section-card helper-card">
            <span className="eyebrow">Session focus</span>
            <h2>Keep your study flow compact.</h2>
            <p>
              Search at the top, open a subject, and use the textbook reader without losing context.
            </p>
          </section>
        </aside>
      </div>
    </section>
  )
}

export function HomePage({ isAuthenticated, user, query = '', onQueryChange = () => {} }) {
  if (isAuthenticated) {
    return <DashboardView user={user} query={query} onQueryChange={onQueryChange} />
  }

  return <LandingPage />
}
