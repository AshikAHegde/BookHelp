import { NavLink } from 'react-router-dom'

function getNavLinkClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link'
}

export function Navbar({ isAuthenticated, user, onLogout }) {
  return (
    <header className="site-header">
      <div className="site-branding">
        <span className="brand-mark">B</span>
        <div>
          <p className="brand-kicker">BookHelp</p>
          <h1 className="brand-title">AI Textbook Tutor</h1>
        </div>
      </div>

      <nav className="site-nav" aria-label="Main navigation">
        <NavLink to="/" end className={getNavLinkClass} id="nav-home">
          Home
        </NavLink>

        {isAuthenticated ? (
          <>
            {user && (
              <div className="nav-user-pill" aria-label="Logged in user">
                <span className="nav-user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="nav-user-info">
                  <span className="nav-user-name">{user.name.split(' ')[0]}</span>
                  <span className="nav-user-class">Class {user.standard}</span>
                </span>
              </div>
            )}
            <button
              type="button"
              className="nav-link nav-button nav-logout"
              onClick={onLogout}
              id="nav-logout-btn"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={getNavLinkClass} id="nav-login">
              Login
            </NavLink>
            <NavLink to="/register" className={getNavLinkClass + ' nav-link-cta'} id="nav-register">
              Sign up free
            </NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
