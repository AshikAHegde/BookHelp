import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useMatch } from 'react-router-dom'
import { DashboardShell } from './components/DashboardShell.jsx'
import { getAuthUser, hasAuthToken, setAuthToken } from './lib/authApi.js'
import { AuthPage } from './pages/AuthPage.jsx'
import { BookPage } from './pages/BookPage.jsx'
import { HomePage } from './pages/HomePage.jsx'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasAuthToken)
  const [user, setUser] = useState(getAuthUser)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('bookhelp_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  // BookPage is full-screen — no shell around it
  const onBookPage = useMatch('/book/:id')
  const location = useLocation()
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register'

  useEffect(() => {
    try {
      localStorage.setItem('bookhelp_sidebar_collapsed', String(sidebarCollapsed))
    } catch {
      // ignore persistence issues
    }
  }, [sidebarCollapsed])

  function handleAuthSuccess(userData) {
    setIsAuthenticated(true)
    setUser(userData)
  }

  function handleLogout() {
    setAuthToken(null, null)
    setIsAuthenticated(false)
    setUser(null)
    setSearchQuery('')
  }

  // Full-screen routes (no navbar / footer)
  if (onBookPage) {
    return (
      <Routes>
        <Route
          path="/book/:id"
          element={isAuthenticated ? <BookPage /> : <Navigate to="/login" replace />}
        />
      </Routes>
    )
  }

  if (isAuthRoute) {
    return (
      <div className="auth-shell">
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <AuthPage key="login" mode="login" onAuthSuccess={handleAuthSuccess} />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <AuthPage key="register" mode="register" onAuthSuccess={handleAuthSuccess} />
              )
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <DashboardShell
        user={user}
        onUpdateUser={setUser}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchFocus={() => {
          if (!searchQuery) {
            setSearchQuery('')
          }
        }}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        onLogout={handleLogout}
      >
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                isAuthenticated={isAuthenticated}
                user={user}
                query={searchQuery}
                onQueryChange={setSearchQuery}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardShell>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage isAuthenticated={isAuthenticated} user={user} />}
      />
      <Route
        path="/login"
        element={
          <AuthPage key="login" mode="login" onAuthSuccess={handleAuthSuccess} />
        }
      />
      <Route
        path="/register"
        element={
          <AuthPage key="register" mode="register" onAuthSuccess={handleAuthSuccess} />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
