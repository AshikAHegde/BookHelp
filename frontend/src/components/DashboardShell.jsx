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
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
  const shellRef = useRef(null)

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
                      <button type="button" className="popover-action popover-collapse-action" onClick={onToggleSidebar}>
                        <SlidersHorizontal size={16} />
                        <span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
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
    </div>
  )
}
