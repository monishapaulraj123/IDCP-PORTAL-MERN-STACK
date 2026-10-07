import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { db } from '../db/index.js'
import requireAuth from '../middleware/requireAuth.js'
import validate from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

// Business hours: 09:00–18:00, 30-minute slots, used both to render
// "available slots" to the customer and to validate bookings server-side
// (never trusting whatever time string the client sends).
const SLOT_START_MIN = 9 * 60
const SLOT_END_MIN = 18 * 60
const SLOT_STEP_MIN = 30

function generateDaySlots() {
  const slots = []
  for (let m = SLOT_START_MIN; m < SLOT_END_MIN; m += SLOT_STEP_MIN) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return slots
}
const DAY_SLOTS = generateDaySlots()

function to12Hour(time24) {
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

function isPastDateTime(date, time) {
  const dt = new Date(`${date}T${time}:00`)
  return dt.getTime() < Date.now()
}

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Rescheduled']

function locationForMode(mode) {
  if (mode === 'Virtual Meeting') return 'Virtual Meeting'
  if (mode === 'Site Visit') return 'Project Site'
  return 'IDCP Design Studio'
}

// Restricts a base appointment query to what the current role is allowed
// to see. This is the real access boundary — enforced in SQL, not just
// hidden in the UI.
function scopeToRole(user) {
  if (user.role === 'admin') return { clause: '1=1', params: [] }
  if (user.role === 'customer') {
    return { clause: 'a.project_id IN (SELECT id FROM projects WHERE customer_id = ?)', params: [user.customer_id] }
  }
  if (user.role === 'designer') {
    const designer = db.prepare('SELECT name FROM designers WHERE id = ?').get(user.designer_id)
    return { clause: 'a.designer = ?', params: [designer?.name || '__none__'] }
  }
  if (user.role === 'contractor') {
    const contractor = db.prepare('SELECT name FROM contractors WHERE id = ?').get(user.contractor_id)
    return { clause: 'a.project_id IN (SELECT id FROM projects WHERE contractor = ?)', params: [contractor?.name || '__none__'] }
  }
  return { clause: '0=1', params: [] }
}

// GET /api/appointments — role-scoped list
router.get('/', (req, res) => {
  const { clause, params } = scopeToRole(req.user)
  const rows = db
    .prepare(`SELECT a.* FROM appointments a WHERE ${clause} ORDER BY a.date ASC, a.time ASC`)
    .all(...params)
  res.json({ appointments: rows.map(serializeAppointment) })
})

// GET /api/appointments/availability?designer=Name&date=YYYY-MM-DD
router.get(
  '/availability',
  [
    query('designer').notEmpty().withMessage('designer is required.'),
    query('date').isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD).')
  ],
  validate,
  (req, res) => {
    const { designer, date } = req.query
    const today = new Date().toISOString().slice(0, 10)
    if (date < today) {
      return res.json({ date, designer, slots: DAY_SLOTS.map((time) => ({ time, label: to12Hour(time), available: false })) })
    }

    const booked = new Set(
      db
        .prepare(
          `SELECT time FROM appointments WHERE designer = ? AND date = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
        )
        .all(designer, date, ...ACTIVE_STATUSES)
        .map((r) => r.time)
    )

    const slots = DAY_SLOTS.map((time) => {
      const isPast = date === today && isPastDateTime(date, time)
      return { time, label: to12Hour(time), available: !booked.has(time) && !isPast }
    })

    res.json({ date, designer, slots })
  }
)

// POST /api/appointments — schedule a new appointment
router.post(
  '/',
  [
    body('projectId').isInt().withMessage('projectId is required.'),
    body('designer').isString().trim().notEmpty().withMessage('designer is required.'),
    body('date').isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD).'),
    body('time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('time must be in 24h HH:MM format.'),
    body('mode').isIn(['In Person', 'Virtual Meeting', 'Site Visit']).withMessage('Invalid mode.'),
    body('tag').optional().isString().trim().isLength({ max: 120 })
  ],
  validate,
  (req, res) => {
    const { projectId, designer, date, time, mode, tag } = req.body

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    if (!project) return res.status(404).json({ error: 'Project not found.' })

    // Customers may only book appointments for their own project.
    if (req.user.role === 'customer' && project.customer_id !== req.user.customer_id) {
      return res.status(403).json({ error: 'You can only book appointments for your own project.' })
    }

    const today = new Date().toISOString().slice(0, 10)
    if (date < today || (date === today && isPastDateTime(date, time))) {
      return res.status(400).json({ error: 'Cannot book an appointment in the past.' })
    }
    if (!DAY_SLOTS.includes(time)) {
      return res.status(400).json({ error: 'That time is outside business hours (09:00–18:00) or not a valid 30-minute slot.' })
    }

    const conflict = db
      .prepare(
        `SELECT id FROM appointments WHERE designer = ? AND date = ? AND time = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
      )
      .get(designer, date, time, ...ACTIVE_STATUSES)
    if (conflict) {
      return res.status(409).json({ error: 'That slot was just booked by someone else. Please choose another time.' })
    }

    const info = db
      .prepare(
        `INSERT INTO appointments (project_id, customer_name, project_name, designer, date, time, time_label, mode, location, tag, status, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`
      )
      .run(project.id, project.customer_name, project.name, designer, date, time, to12Hour(time), mode, locationForMode(mode), tag || 'Project Discussion', req.user.id)

    const created = db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json({ appointment: serializeAppointment(created) })
  }
)

// PATCH /api/appointments/:id/status — designer/admin confirm/reject/complete;
// customer may cancel their own pending/confirmed appointment.
router.patch(
  '/:id/status',
  [
    param('id').isInt(),
    body('status').isIn(['Confirmed', 'Rejected', 'Cancelled', 'Completed']).withMessage('Invalid status.')
  ],
  validate,
  (req, res) => {
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' })

    const { status } = req.body
    const role = req.user.role

    const isOwnerCustomer =
      role === 'customer' &&
      db.prepare('SELECT customer_id FROM projects WHERE id = ?').get(appointment.project_id)?.customer_id === req.user.customer_id
    const isOwnerDesigner =
      role === 'designer' &&
      db.prepare('SELECT name FROM designers WHERE id = ?').get(req.user.designer_id)?.name === appointment.designer

    if (role === 'admin' || isOwnerDesigner) {
      // Designers/admins can confirm, reject, complete, or cancel.
    } else if (isOwnerCustomer) {
      if (status !== 'Cancelled') {
        return res.status(403).json({ error: 'Customers may only cancel an appointment, not change it to other statuses.' })
      }
    } else {
      return res.status(403).json({ error: 'You do not have permission to update this appointment.' })
    }

    if (['Rejected', 'Cancelled', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({ error: `Appointment is already ${appointment.status.toLowerCase()} and cannot be changed further.` })
    }

    db.prepare("UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, appointment.id)
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id)
    res.json({ appointment: serializeAppointment(updated) })
  }
)

// PATCH /api/appointments/:id/reschedule — moves to a new date/time.
router.patch(
  '/:id/reschedule',
  [
    param('id').isInt(),
    body('date').isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD).'),
    body('time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('time must be in 24h HH:MM format.')
  ],
  validate,
  (req, res) => {
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' })

    const role = req.user.role
    const isOwnerCustomer =
      role === 'customer' &&
      db.prepare('SELECT customer_id FROM projects WHERE id = ?').get(appointment.project_id)?.customer_id === req.user.customer_id
    const isOwnerDesigner =
      role === 'designer' &&
      db.prepare('SELECT name FROM designers WHERE id = ?').get(req.user.designer_id)?.name === appointment.designer

    if (role !== 'admin' && !isOwnerCustomer && !isOwnerDesigner) {
      return res.status(403).json({ error: 'You do not have permission to reschedule this appointment.' })
    }
    if (['Rejected', 'Cancelled', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({ error: `Appointment is already ${appointment.status.toLowerCase()} and cannot be rescheduled.` })
    }

    const { date, time } = req.body
    const today = new Date().toISOString().slice(0, 10)
    if (date < today || (date === today && isPastDateTime(date, time))) {
      return res.status(400).json({ error: 'Cannot reschedule an appointment into the past.' })
    }
    if (!DAY_SLOTS.includes(time)) {
      return res.status(400).json({ error: 'That time is outside business hours (09:00–18:00) or not a valid 30-minute slot.' })
    }
    const conflict = db
      .prepare(
        `SELECT id FROM appointments WHERE id != ? AND designer = ? AND date = ? AND time = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
      )
      .get(appointment.id, appointment.designer, date, time, ...ACTIVE_STATUSES)
    if (conflict) {
      return res.status(409).json({ error: 'That slot is already booked. Please choose another time.' })
    }

    db.prepare(
      "UPDATE appointments SET date = ?, time = ?, time_label = ?, status = 'Rescheduled', updated_at = datetime('now') WHERE id = ?"
    ).run(date, time, to12Hour(time), appointment.id)

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id)
    res.json({ appointment: serializeAppointment(updated) })
  }
)

function serializeAppointment(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    customerName: row.customer_name,
    projectName: row.project_name,
    designer: row.designer,
    date: row.date,
    time: row.time_label,
    time24: row.time,
    mode: row.mode,
    location: row.location,
    tag: row.tag,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export default router
