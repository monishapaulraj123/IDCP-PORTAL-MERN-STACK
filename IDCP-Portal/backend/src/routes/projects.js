import { Router } from 'express'
import { body, param } from 'express-validator'
import { db } from '../db/index.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'
import validate from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

const PROJECT_STAGES = [
  'Consultation', 'Site Measurement', 'Requirement Analysis', 'Design', '3D Visualization',
  'Design Approval', 'Quotation', 'Material Selection', 'Procurement', 'Execution',
  'Installation', 'Quality Inspection', 'Final Handover', 'Completed'
]
const progressPercent = (idx) => Math.round((idx / (PROJECT_STAGES.length - 1)) * 100)

function serialize(row) {
  return {
    id: row.id,
    projectId: row.project_code,
    customerId: row.customer_id,
    name: row.name,
    customerName: row.customer_name,
    projectType: row.project_type,
    designer: row.designer,
    contractor: row.contractor,
    location: row.location,
    budget: row.budget,
    startDate: row.start_date,
    endDate: row.end_date,
    priority: row.priority,
    currentStageIndex: row.current_stage_index,
    currentStage: PROJECT_STAGES[row.current_stage_index],
    nextStage: PROJECT_STAGES[row.current_stage_index + 1] || null,
    progress: progressPercent(row.current_stage_index),
    status: row.status
  }
}

function scopeToRole(user) {
  if (user.role === 'admin') return { clause: '1=1', params: [] }
  if (user.role === 'customer') return { clause: 'customer_id = ?', params: [user.customer_id] }
  if (user.role === 'designer') {
    const designer = db.prepare('SELECT name FROM designers WHERE id = ?').get(user.designer_id)
    return { clause: 'designer = ?', params: [designer?.name || '__none__'] }
  }
  if (user.role === 'contractor') {
    const contractor = db.prepare('SELECT name FROM contractors WHERE id = ?').get(user.contractor_id)
    return { clause: 'contractor = ?', params: [contractor?.name || '__none__'] }
  }
  return { clause: '0=1', params: [] }
}

// GET /api/projects — every role sees only projects relevant to them.
router.get('/', (req, res) => {
  const { clause, params } = scopeToRole(req.user)
  const rows = db.prepare(`SELECT * FROM projects WHERE ${clause} ORDER BY id DESC`).all(...params)
  res.json({ projects: rows.map(serialize), stages: PROJECT_STAGES })
})

router.post(
  '/',
  requireRole('admin'),
  [
    body('customerId').isInt(),
    body('name').isString().trim().notEmpty(),
    body('projectType').optional().isString(),
    body('budget').optional().isFloat({ min: 0 })
  ],
  validate,
  (req, res) => {
    const b = req.body
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(b.customerId)
    if (!customer) return res.status(404).json({ error: 'Customer not found.' })

    const count = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n
    const projectCode = `PRJ-${2601 + count}`
    const info = db
      .prepare(
        `INSERT INTO projects (project_code, customer_id, name, customer_name, project_type, designer, contractor, location, budget, start_date, end_date, priority, current_stage_index, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Ongoing')`
      )
      .run(
        projectCode,
        customer.id,
        b.name,
        customer.name,
        b.projectType || customer.project_type,
        b.designer || customer.designer,
        b.contractor || customer.contractor,
        b.location || customer.location,
        b.budget || customer.budget,
        b.startDate || customer.start_date,
        b.endDate || customer.end_date,
        b.priority || 'Medium'
      )
    res.status(201).json({ project: serialize(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

router.patch('/:id/advance', requireRole('admin', 'designer'), [param('id').isInt()], validate, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found.' })
  const nextIndex = Math.min(project.current_stage_index + 1, PROJECT_STAGES.length - 1)
  const isComplete = nextIndex === PROJECT_STAGES.length - 1
  const status = isComplete ? 'Completed' : project.status === 'Delayed' ? 'Delayed' : 'Ongoing'
  db.prepare('UPDATE projects SET current_stage_index = ?, status = ? WHERE id = ?').run(nextIndex, status, project.id)
  res.json({ project: serialize(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id)) })
})

router.patch('/:id/revert', requireRole('admin', 'designer'), [param('id').isInt()], validate, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found.' })
  const prevIndex = Math.max(project.current_stage_index - 1, 0)
  const status = project.status === 'Delayed' ? 'Delayed' : 'Ongoing'
  db.prepare('UPDATE projects SET current_stage_index = ?, status = ? WHERE id = ?').run(prevIndex, status, project.id)
  res.json({ project: serialize(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id)) })
})

export default router
