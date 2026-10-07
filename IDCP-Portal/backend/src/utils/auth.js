import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

if (!JWT_SECRET) {
  // Fail loudly and immediately rather than silently signing tokens with
  // `undefined` (which would make every token forgeable/guessable).
  throw new Error(
    'JWT_SECRET is not set. Copy backend/.env.example to backend/.env and set a strong random JWT_SECRET before starting the server.'
  )
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function toPublicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: row.role_label,
    avatarInitial: row.avatar_initial,
    customerId: row.customer_id,
    designerId: row.designer_id,
    contractorId: row.contractor_id
  }
}
