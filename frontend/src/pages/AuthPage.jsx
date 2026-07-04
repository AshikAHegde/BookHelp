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
    <section className="page-section auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-badge">{isLoginMode ? '👋' : '🎒'}</div>
          <span className="eyebrow">{isLoginMode ? 'Welcome back' : 'Join BookHelp'}</span>
          <h2>{isLoginMode ? 'Login to continue' : 'Create your account'}</h2>
          <p>
            {isLoginMode
              ? 'Pick up right where you left off with your study sessions.'
              : 'Set up your student profile and start learning today.'}
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
                placeholder="e.g. Arjun Sharma"
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
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Class {n}
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
            id="auth-submit-btn"
          >
            {isSubmitting ? (
              <span className="btn-loading">
                <span className="spinner" />
                Please wait…
              </span>
            ) : isLoginMode ? (
              'Login →'
            ) : (
              'Create account →'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <span>{isLoginMode ? "Don't have an account?" : 'Already have an account?'}</span>
          <Link to={isLoginMode ? '/register' : '/login'} id="auth-switch-link">
            {isLoginMode ? 'Register now' : 'Login instead'}
          </Link>
        </div>
      </div>
    </section>
  )
}
