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
    contractorId: row.contractor_code,
    name: row.name,
    contactPerson: row.contact_person,
    specialization: row.specialization,
    status: row.status,
    experience: row.experience,
    rating: row.rating,
    phone: row.phone,
    email: row.email,
    currentProject: row.current_project
  }
}

router.get('/', (req, res) => {
  res.json({ contractors: db.prepare('SELECT * FROM contractors ORDER BY name').all().map(serialize) })
})

router.post(
  '/',
  requireRole('admin'),
  [body('name').isString().trim().notEmpty(), body('email').isEmail().normalizeEmail()],
  validate,
  (req, res) => {
    const b = req.body
    const count = db.prepare('SELECT COUNT(*) AS n FROM contractors').get().n
    const info = db
      .prepare(
        `INSERT INTO contractors (contractor_code, name, contact_person, specialization, status, experience, rating, phone, email, current_project)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`CTR-${4501 + count}`, b.name, b.contactPerson || null, b.specialization || null, b.status || 'Active', b.experience || null, b.rating || 4.5, b.phone || null, b.email, b.currentProject || null)
    res.status(201).json({ contractor: serialize(db.prepare('SELECT * FROM contractors WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.delete('/:id', requireRole('admin'), [param('id').isInt()], validate, (req, res) => {
  db.prepare('DELETE FROM contractors WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
