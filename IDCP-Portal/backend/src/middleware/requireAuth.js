import { verifyToken } from '../utils/auth.js'
import { db } from '../db/index.js'

// Verifies the JWT on every protected request and loads the current user
// fresh from the database (so a deactivated/deleted user is rejected
// immediately, not just once at login time). This is the backend
// enforcement point — the frontend's route guards are for UX only and are
// never trusted on their own.
export default function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Not authenticated. Missing or malformed Authorization header.' })
  }

  try {
    const payload = verifyToken(token)
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub)
    if (!user) {
      return res.status(401).json({ error: 'Session is no longer valid. Please log in again.' })
    }
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }
}
