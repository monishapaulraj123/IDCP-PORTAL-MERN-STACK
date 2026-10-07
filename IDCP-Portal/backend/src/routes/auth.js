import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { body } from 'express-validator'
import { db } from '../db/index.js'
import { signToken, toPublicUser } from '../utils/auth.js'
import validate from '../middleware/validate.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

// Slows down credential-stuffing / brute-force attempts against login.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' }
})

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 1 }).withMessage('Password is required.')
  ],
  validate,
  (req, res) => {
    const { email, password } = req.body
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email)

    // Same generic error whether the email doesn't exist or the password
    // is wrong, so login can't be used to enumerate valid accounts.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const token = signToken(user)
    res.json({ token, user: toPublicUser(user) })
  }
)

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) })
})

// Stateless JWTs can't be revoked server-side without a blocklist; the
// frontend simply discards the token. This endpoint exists for symmetry
// and so a future token-blocklist/refresh-token store has somewhere to
// plug in without changing the frontend contract.
router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true })
})

export default router
