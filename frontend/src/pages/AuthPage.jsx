import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Sparkles, BookOpenText } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser, registerUser, setAuthToken } from '../lib/authApi.js'

function getInitialFormState(mode) {
  return {
    name: '',
    email: '',
    password: '',
    standard: mode === 'register' ? '10' : '',
  }
}

const BENEFITS = [
  {
    title: 'Textbook grounded answers',
    description: 'Keep every response tied to the actual book content.',
    icon: BookOpenText,
  },
  {
    title: 'Clean study flow',
    description: 'Log in quickly and continue from your last session.',
    icon: Sparkles,
  },
  {
    title: 'Protected sessions',
    description: 'Your account stays saved with token-based auth.',
    icon: ShieldCheck,
  },
]

export function AuthPage({ mode, onAuthSuccess }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(() => getInitialFormState(mode))
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLoginMode = mode === 'login'

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const payload = isLoginMode
        ? await loginUser({ email: formData.email.trim(), password: formData.password })
        : await registerUser({
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password,
            standard: formData.standard,
          })

      setAuthToken(payload.token, payload.user)
      onAuthSuccess(payload.user)
      navigate('/')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-frame">
        <motion.div
          className="auth-aside premium-surface"
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <span className="eyebrow">{isLoginMode ? 'Welcome back' : 'Create your account'}</span>
          <h1>{isLoginMode ? 'Continue your study session.' : 'Start with a cleaner study workspace.'}</h1>
          <p>
            {isLoginMode
              ? 'Open your subjects, keep the chat history compact, and pick up where you left off.'
              : 'Register once and keep your class, books, and textbook questions in one premium dashboard.'}
          </p>

          <div className="auth-benefits">
            {BENEFITS.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="auth-benefit">
                  <span className="auth-benefit-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          className="auth-card premium-surface"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut', delay: 0.05 }}
        >
          <div className="auth-card-header">
            <span className="eyebrow">{isLoginMode ? 'Sign in' : 'Create account'}</span>
            <h2>{isLoginMode ? 'Log in' : 'Register'}</h2>
            <p>
              {isLoginMode
                ? 'Use your saved account to open the dashboard.'
                : 'Enter the details for your class profile and create your account.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {!isLoginMode && (
              <div className="form-field">
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={isLoginMode ? 'Your password' : 'Choose a strong password'}
                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {!isLoginMode && (
              <div className="form-field">
                <label htmlFor="auth-standard">Class / Standard</label>
                <select
                  id="auth-standard"
                  name="standard"
                  value={formData.standard}
                  onChange={handleChange}
                  required
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={String(value)}>
                      Class {value}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {errorMessage && (
              <p className="status status-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="button button-primary auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="button-loading">
                  <span className="spinner" />
                  Please wait
                </span>
              ) : (
                <>
                  {isLoginMode ? 'Log in' : 'Create account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            <span>{isLoginMode ? "Don't have an account?" : 'Already have an account?'}</span>
            <Link to={isLoginMode ? '/register' : '/login'}>
              {isLoginMode ? 'Register now' : 'Log in instead'}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
