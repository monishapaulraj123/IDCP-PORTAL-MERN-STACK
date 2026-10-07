import { Router } from 'express'
import { body, param } from 'express-validator'
import { db } from '../db/index.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'
import validate from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

function serialize(row) {
  return {
    id: row.id,
    designerId: row.designer_code,
    name: row.name,
    specialization: row.specialization,
    experience: row.experience,
    availability: row.availability,
    rating: row.rating,
    activeProjects: row.active_projects,
    phone: row.phone,
    email: row.email
  }
}

// Readable by any authenticated role — other pages (e.g. the customer's
// appointment-booking form) need the designer directory even though the
// full /designers management page in the UI is admin-only.
router.get('/', (req, res) => {
  res.json({ designers: db.prepare('SELECT * FROM designers ORDER BY name').all().map(serialize) })
})

router.post(
  '/',
  requireRole('admin'),
  [body('name').isString().trim().notEmpty(), body('email').isEmail().normalizeEmail()],
  validate,
  (req, res) => {
    const b = req.body
    const count = db.prepare('SELECT COUNT(*) AS n FROM designers').get().n
    const info = db
      .prepare(
        `INSERT INTO designers (designer_code, name, specialization, experience, availability, rating, active_projects, phone, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`DSG-${1024 + count}`, b.name, b.specialization || null, b.experience || null, b.availability || 'Available', b.rating || 4.5, b.activeProjects || 0, b.phone || null, b.email)
    res.status(201).json({ designer: serialize(db.prepare('SELECT * FROM designers WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.delete('/:id', requireRole('admin'), [param('id').isInt()], validate, (req, res) => {
  db.prepare('DELETE FROM designers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
