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
    supplierId: row.supplier_code,
    name: row.name,
    category: row.category,
    contactPerson: row.contact_person,
    rating: row.rating,
    phone: row.phone,
    email: row.email,
    deliveryStatus: row.delivery_status,
    materialsSupplied: row.materials_supplied ? JSON.parse(row.materials_supplied) : []
  }
}

router.get('/', (req, res) => {
  res.json({ suppliers: db.prepare('SELECT * FROM suppliers ORDER BY name').all().map(serialize) })
})

router.post(
  '/',
  requireRole('admin'),
  [body('name').isString().trim().notEmpty(), body('email').isEmail().normalizeEmail()],
  validate,
  (req, res) => {
    const b = req.body
    const count = db.prepare('SELECT COUNT(*) AS n FROM suppliers').get().n
    const info = db
      .prepare(
        `INSERT INTO suppliers (supplier_code, name, category, contact_person, rating, phone, email, delivery_status, materials_supplied)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`SUP-${6501 + count}`, b.name, b.category || null, b.contactPerson || null, b.rating || 4.5, b.phone || null, b.email, b.deliveryStatus || 'Pending', JSON.stringify(b.materialsSupplied || []))
    res.status(201).json({ supplier: serialize(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.delete('/:id', requireRole('admin'), [param('id').isInt()], validate, (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
