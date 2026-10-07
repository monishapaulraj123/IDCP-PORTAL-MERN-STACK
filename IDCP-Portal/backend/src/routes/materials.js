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
    sku: row.sku,
    name: row.name,
    category: row.category,
    supplier: row.supplier,
    unitPrice: row.unit_price,
    unit: row.unit,
    stock: row.stock,
    quantityAvailable: row.quantity_available
  }
}

router.get('/', requireRole('admin', 'designer', 'contractor'), (req, res) => {
  res.json({ materials: db.prepare('SELECT * FROM materials ORDER BY name').all().map(serialize) })
})

router.post(
  '/',
  requireRole('admin'),
  [body('name').isString().trim().notEmpty(), body('unitPrice').isFloat({ min: 0 })],
  validate,
  (req, res) => {
    const b = req.body
    const count = db.prepare('SELECT COUNT(*) AS n FROM materials').get().n
    const info = db
      .prepare(
        `INSERT INTO materials (sku, name, category, supplier, unit_price, unit, stock, quantity_available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`MAT-${8801 + count}`, b.name, b.category || null, b.supplier || null, b.unitPrice, b.unit || 'unit', b.stock || 'In Stock', b.quantityAvailable || 0)
    res.status(201).json({ material: serialize(db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.delete('/:id', requireRole('admin'), [param('id').isInt()], validate, (req, res) => {
  db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
