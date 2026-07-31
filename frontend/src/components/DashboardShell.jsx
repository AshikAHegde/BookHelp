import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  BookOpenText,
  ChevronDown,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { updateUserProfileApi, setAuthToken } from '../lib/authApi.js'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, target: 'top' },
  { id: 'subjects', label: 'Subjects', icon: BookOpenText, target: 'subjects' },
]

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function DashboardShell({
  user,
  onUpdateUser,
  searchValue,
  onSearchChange,
  onSearchFocus,
  sidebarCollapsed,
  onToggleSidebar,
  onLogout,
  children,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    password: '',
    standard: '10',
  })
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const shellRef = useRef(null)

  useEffect(() => {
    if (showProfileModal && user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        password: '',
        standard: String(user.standard || '10'),
      })
      setProfileError('')
      setProfileSuccess('')
    }
  }, [showProfileModal, user])

  async function handleProfileSubmit(event) {
    event.preventDefault()
    setIsUpdatingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const payload = await updateUserProfileApi({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        password: profileForm.password || undefined,
        standard: Number(profileForm.standard),
      })

      setAuthToken(payload.token, payload.user)
      if (onUpdateUser) {
        onUpdateUser(payload.user)
      }
      setProfileSuccess('Profile updated successfully!')
      setTimeout(() => {
        setShowProfileModal(false)
      }, 1200)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  useEffect(() => {
    setActiveNav('overview')
    setShowNotifications(false)
    setShowSettings(false)
  }, [location.pathname])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!shellRef.current?.contains(event.target)) {
        setShowNotifications(false)
        setShowSettings(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const profileName = user?.name ?? 'Guest'
  const profileLabel = user?.standard ? `Class ${user.standard}` : 'Account'
  const initials = useMemo(() => getInitials(profileName), [profileName])

  function scrollToTarget(target) {
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const element = document.getElementById(target)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleNavSelect(itemId) {
    setActiveNav(itemId)
    const item = NAV_ITEMS.find((entry) => entry.id === itemId)
    if (item) scrollToTarget(item.target)
  }

  return (
    <div className="dashboard-shell" ref={shellRef} data-sidebar-collapsed={sidebarCollapsed}>
      <aside className={`app-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="Sidebar">
        <div className="sidebar-brand">
          <button
            type="button"
            className="sidebar-brand-lockup"
            onClick={() => navigate('/')}
            aria-label="BookHelp home"
          >
            <span className="brand-mark">B</span>
            <span className="sidebar-brand-copy">
              <strong>BookHelp</strong>
              <span>Textbook workspace</span>
            </span>
          </button>

          <button
            type="button"
            className="icon-button sidebar-collapse"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-link ${activeNav === item.id ? 'is-active' : ''}`}
                onClick={() => handleNavSelect(item.id)}
              >
                <span className="sidebar-link-indicator" aria-hidden="true" />
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card-icon">
            <Sparkles size={16} />
          </div>
          <div className="sidebar-card-copy">
            <strong>Focused sessions</strong>
            <p>Open a subject, ask a question, and keep the flow uninterrupted.</p>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <motion.header
          className="app-topbar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="topbar-left">
            <div className="topbar-search">
              <Search size={18} />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onFocus={onSearchFocus}
                placeholder="Search subjects or PDFs"
                aria-label="Search subjects"
              />
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-popover-wrap">
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setShowNotifications((value) => !value)
                  setShowSettings(false)
                }}
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <Bell size={18} />
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <button
                      type="button"
                      className="popover-backdrop"
                      aria-label="Close notifications"
                      onClick={() => setShowNotifications(false)}
                    />
                    <motion.div
                      className="topbar-popover"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="status"
                      aria-live="polite"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <strong>No new notifications</strong>
                      <p>You’re all caught up for now.</p>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="topbar-popover-wrap">
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setShowSettings((value) => !value)
                  setShowNotifications(false)
                }}
                aria-label="Settings"
                aria-expanded={showSettings}
              >
                <Settings2 size={18} />
              </button>

              <AnimatePresence>
                {showSettings && (
                  <>
                    <button
                      type="button"
                      className="popover-backdrop"
                      aria-label="Close settings"
                      onClick={() => setShowSettings(false)}
                    />
                    <motion.div
                      className="topbar-popover topbar-popover-wide"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="popover-action"
                        onClick={() => {
                          setShowProfileModal(true)
                          setShowSettings(false)
                        }}
                      >
                        <UserRound size={16} />
                        <span>Edit profile</span>
                      </button>
                      <button type="button" className="popover-action" onClick={onLogout}>
                        <LogOut size={16} />
                        <span>Sign out</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button type="button" className="profile-chip" onClick={() => setShowSettings((value) => !value)}>
              <span className="profile-avatar" aria-hidden="true">
                {initials || <UserRound size={16} />}
              </span>
              <span className="profile-copy">
                <strong>{profileName}</strong>
                <span>{profileLabel}</span>
              </span>
              <ChevronDown size={16} />
            </button>
          </div>
        </motion.header>

        <main className="dashboard-content">{children}</main>
      </div>

      <AnimatePresence>
        {showProfileModal && (
          <div className="profile-modal-overlay">
            <motion.div
              className="popover-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              style={{ zIndex: 9998 }}
            />
            <motion.div
              className="profile-modal-card premium-surface"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="profile-modal-header">
                <div>
                  <span className="eyebrow">Settings</span>
                  <h2>Edit Profile</h2>
                </div>
                <button
                  type="button"
                  className="icon-button modal-close-btn"
                  onClick={() => setShowProfileModal(false)}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form className="profile-modal-form" onSubmit={handleProfileSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="profile-name">Full name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profile-email">Email address</label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="student@example.com"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profile-password">New password</label>
                  <input
                    id="profile-password"
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profile-standard">Class / Standard</label>
                  <select
                    id="profile-standard"
                    value={profileForm.standard}
                    onChange={(e) => setProfileForm(p => ({ ...p, standard: e.target.value }))}
                    required
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={String(value)}>
                        Class {value}
                      </option>
                    ))}
                  </select>
                </div>

                {profileError && (
                  <p className="status status-error" role="alert">
                    {profileError}
                  </p>
                )}

                {profileSuccess && (
                  <p className="status status-success" role="alert">
                    {profileSuccess}
                  </p>
                )}

                <div className="profile-modal-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => setShowProfileModal(false)}
                    disabled={isUpdatingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={isUpdatingProfile}
                  >
                    {isUpdatingProfile ? (
                      <span className="button-loading">
                        <span className="spinner" />
                        Saving
                      </span>
                    ) : (
                      'Save changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
