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
    quotationId: row.quotation_code,
    projectId: row.project_id,
    customerName: row.customer_name,
    projectName: row.project_name,
    projectType: row.project_type,
    amount: row.amount,
    status: row.status,
    date: row.date,
    validUntil: row.valid_until
  }
}

function scopeToRole(user) {
  if (user.role === 'admin' || user.role === 'designer') return { clause: '1=1', params: [] }
  if (user.role === 'customer') {
    return { clause: 'project_id IN (SELECT id FROM projects WHERE customer_id = ?)', params: [user.customer_id] }
  }
  return { clause: '0=1', params: [] }
}

router.get('/', requireRole('admin', 'designer', 'customer'), (req, res) => {
  const { clause, params } = scopeToRole(req.user)
  res.json({ quotations: db.prepare(`SELECT * FROM quotations WHERE ${clause} ORDER BY date DESC`).all(...params).map(serialize) })
})

router.post(
  '/',
  requireRole('admin', 'designer'),
  [
    body('projectId').isInt().withMessage('projectId is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number.'),
    body('validUntil').optional().isISO8601()
  ],
  validate,
  (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.body.projectId)
    if (!project) return res.status(404).json({ error: 'Project not found.' })

    const count = db.prepare('SELECT COUNT(*) AS n FROM quotations').get().n
    const quotationCode = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
    const today = new Date().toISOString().slice(0, 10)
    const validUntil = req.body.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)

    const info = db
      .prepare(
        `INSERT INTO quotations (quotation_code, project_id, customer_name, project_name, project_type, amount, status, date, valid_until)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`
      )
      .run(quotationCode, project.id, project.customer_name, project.name, project.project_type, req.body.amount, today, validUntil)

    res.status(201).json({ quotation: serialize(db.prepare('SELECT * FROM quotations WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.patch(
  '/:id/status',
  requireRole('admin', 'designer', 'customer'),
  [param('id').isInt(), body('status').isIn(['Approved', 'Pending', 'Rejected'])],
  validate,
  (req, res) => {
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id)
    if (!quotation) return res.status(404).json({ error: 'Quotation not found.' })

    if (req.user.role === 'customer') {
      const owns = db.prepare('SELECT customer_id FROM projects WHERE id = ?').get(quotation.project_id)?.customer_id === req.user.customer_id
      if (!owns) return res.status(403).json({ error: 'You can only respond to your own quotations.' })
      if (!['Approved', 'Rejected'].includes(req.body.status)) {
        return res.status(403).json({ error: 'Customers may only approve or reject a quotation.' })
      }
    }

    db.prepare('UPDATE quotations SET status = ? WHERE id = ?').run(req.body.status, quotation.id)
    res.json({ quotation: serialize(db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotation.id)) })
  }
)

export default router
