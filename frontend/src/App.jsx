import { useState } from 'react'
import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { Footer } from './components/Footer.jsx'
import { Navbar } from './components/Navbar.jsx'
import { getAuthUser, hasAuthToken, setAuthToken } from './lib/authApi.js'
import { AuthPage } from './pages/AuthPage.jsx'
import { BookPage } from './pages/BookPage.jsx'
import { HomePage } from './pages/HomePage.jsx'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasAuthToken)
  const [user, setUser] = useState(getAuthUser)

  // BookPage is full-screen — no shell around it
  const onBookPage = useMatch('/book/:id')

  function handleAuthSuccess(userData) {
    setIsAuthenticated(true)
    setUser(userData)
  }

  function handleLogout() {
    setAuthToken(null, null)
    setIsAuthenticated(false)
    setUser(null)
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

  return (
    <div className="app-shell">
      <Navbar isAuthenticated={isAuthenticated} user={user} onLogout={handleLogout} />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage isAuthenticated={isAuthenticated} user={user} />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

export default App
