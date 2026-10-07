// Backend RBAC enforcement. Usage: requireRole('admin', 'designer').
// Must run after requireAuth so req.user is already populated.
// This is the real access-control boundary — every sensitive route uses
// it, so a customer calling a designer/admin-only API directly (bypassing
// the UI entirely) still gets rejected with 403.
export default function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' })
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. This action requires one of: ${allowedRoles.join(', ')}.` })
    }
    next()
  }
}
