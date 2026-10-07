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
    customerId: row.customer_code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    location: row.location,
    propertyType: row.property_type,
    projectType: row.project_type,
    budget: row.budget,
    startDate: row.start_date,
    endDate: row.end_date,
    requirements: row.requirements,
    designer: row.designer,
    contractor: row.contractor,
    status: row.status
  }
}

// Admin + designer only, matching the original frontend's /customers route.
router.get('/', requireRole('admin', 'designer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY id DESC').all()
  res.json({ customers: rows.map(serialize) })
})

router.post(
  '/',
  requireRole('admin'),
  [
    body('name').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isString().trim().notEmpty(),
    body('budget').optional().isFloat({ min: 0 })
  ],
  validate,
  (req, res) => {
    const b = req.body
    const count = db.prepare('SELECT COUNT(*) AS n FROM customers').get().n
    const customerCode = `CUS-${1001 + count}`
    const info = db
      .prepare(
        `INSERT INTO customers (customer_code, name, email, phone, address, location, property_type, project_type, budget, start_date, end_date, requirements, designer, contractor, status)
         VALUES (@customer_code, @name, @email, @phone, @address, @location, @property_type, @project_type, @budget, @start_date, @end_date, @requirements, @designer, @contractor, @status)`
      )
      .run({
        customer_code: customerCode,
        name: b.name,
        email: b.email,
        phone: b.phone,
        address: b.address || null,
        location: b.location || null,
        property_type: b.propertyType || null,
        project_type: b.projectType || null,
        budget: b.budget || null,
        start_date: b.startDate || null,
        end_date: b.endDate || null,
        requirements: b.requirements || null,
        designer: b.designer || null,
        contractor: b.contractor || null,
        status: b.status || 'Active'
      })
    res.status(201).json({ customer: serialize(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.delete('/:id', requireRole('admin'), [param('id').isInt()], validate, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
