import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext.jsx'

// Reusable wrapper: renders its children only when someone is logged in
// AND (if a `roles` list is given) their role is allowed on this page.
// Otherwise it redirects — to /login when signed out, or back to
// /dashboard when signed in but the wrong role — using Navigate, so no
// full page reload either way.
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, isRestoring } = useContext(AuthContext)

  // While we're checking a previously-saved token against the backend
  // (GET /api/auth/me), don't redirect yet — otherwise a refresh would
  // always bounce a signed-in user back to /login for a split second.
  if (isRestoring) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
