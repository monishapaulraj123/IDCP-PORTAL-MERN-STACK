import React, { createContext, useCallback, useEffect, useState } from 'react'
import api, { getToken, setToken, setOnUnauthorized } from '../lib/api.js'

export const AuthContext = createContext(null)

// Same public shape as the old frontend-only AuthContext
// (isAuthenticated, user, login, logout) so every page that consumes
// this context keeps working unchanged — only what happens *inside*
// login()/logout() changed: it now talks to the real backend instead of
// matching against an in-memory demo list.
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  // While we check for an existing token on first load, render nothing
  // gated behind auth yet — avoids a flash of the login page for someone
  // who is already signed in.
  const [isRestoring, setIsRestoring] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setIsAuthenticated(false)
    setUser(null)
  }, [])

  // If any API call ever comes back 401 (expired/invalid token), log the
  // user out everywhere immediately rather than leaving stale UI state.
  useEffect(() => {
    setOnUnauthorized(() => logout())
  }, [logout])

  // On mount: if a token was saved from a previous session, validate it
  // against the backend (GET /auth/me) instead of trusting it blindly.
  useEffect(() => {
    const existingToken = getToken()
    if (!existingToken) {
      setIsRestoring(false)
      return
    }
    api
      .get('/auth/me')
      .then(({ user: restoredUser }) => {
        setUser(restoredUser)
        setIsAuthenticated(true)
      })
      .catch(() => {
        setToken(null)
      })
      .finally(() => setIsRestoring(false))
  }, [])

  // Real backend login. Kept synchronous-looking for the caller (Login.jsx
  // awaits it) but now performs a network request and returns null on any
  // failure so the existing "invalid credentials" UI path still works.
  const login = useCallback(async (email, password) => {
    try {
      const { token, user: loggedInUser } = await api.post('/auth/login', { email, password })
      setToken(token)
      setUser(loggedInUser)
      setIsAuthenticated(true)
      return loggedInUser
    } catch (err) {
      return null
    }
  }, [])

  const value = { isAuthenticated, user, login, logout, isRestoring }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
