import { Router } from 'express'
import crypto from 'crypto'
import { body, param } from 'express-validator'
import { db } from '../db/index.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'
import validate from '../middleware/validate.js'
import { createOrder, verifySignature, MOCK_MODE } from '../utils/paymentGateway.js'

const router = Router()
router.use(requireAuth)

function scopeToRole(user) {
  if (user.role === 'admin') return { clause: '1=1', params: [] }
  if (user.role === 'customer') {
    return { clause: 'p.project_id IN (SELECT id FROM projects WHERE customer_id = ?)', params: [user.customer_id] }
  }
  // Designers/contractors are not part of the billing loop in this app
  // (mirrors the original frontend, which only ever showed /payments to
  // admin + customer roles) — enforced again here at the API layer.
  return { clause: '0=1', params: [] }
}

function serializePayment(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    projectId: row.project_id,
    customerName: row.customer_name,
    projectName: row.project_name,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    paymentDate: row.payment_date,
    dueDate: row.due_date,
    status: row.status,
    transactionId: row.transaction_id,
    gateway: row.gateway,
    createdAt: row.created_at
  }
}

// GET /api/payments — role-scoped payment/invoice history
router.get('/', requireRole('admin', 'customer'), (req, res) => {
  const { clause, params } = scopeToRole(req.user)
  const rows = db
    .prepare(`SELECT p.* FROM payments p WHERE ${clause} ORDER BY p.created_at DESC`)
    .all(...params)
  res.json({ payments: rows.map(serializePayment), gatewayMode: MOCK_MODE ? 'mock-sandbox' : 'razorpay-test' })
})

// POST /api/payments/order — start a checkout for a project (creates a
// Pending payment row + a gateway order the frontend's payment modal
// opens against). Amount is validated server-side; the client cannot
// alter it after this point.
router.post(
  '/order',
  [
    body('projectId').isInt().withMessage('projectId is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number.'),
    body('method').optional().isIn(['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Bank Transfer']),
    body('dueDate').optional().isISO8601()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { projectId, amount, method, dueDate } = req.body
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
      if (!project) return res.status(404).json({ error: 'Project not found.' })

      if (req.user.role === 'customer' && project.customer_id !== req.user.customer_id) {
        return res.status(403).json({ error: 'You can only pay for your own project.' })
      }

      const invoiceCount = db.prepare('SELECT COUNT(*) AS n FROM payments').get().n
      const invoiceId = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(3, '0')}`
      const amountInPaise = Math.round(Number(amount) * 100)

      const order = await createOrder({ amountInPaise, currency: 'INR', receipt: invoiceId })

      const info = db
        .prepare(
          `INSERT INTO payments (invoice_id, project_id, customer_name, project_name, amount, currency, method, due_date, status, gateway, gateway_order_id, created_by_user_id)
           VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 'Pending', ?, ?, ?)`
        )
        .run(invoiceId, project.id, project.customer_name, project.name, amount, method || 'UPI', dueDate || null, MOCK_MODE ? 'mock' : 'razorpay', order.id, req.user.id)

      res.status(201).json({
        payment: serializePayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid)),
        gateway: MOCK_MODE ? 'mock' : 'razorpay',
        gatewayKeyId: MOCK_MODE ? null : process.env.RAZORPAY_KEY_ID,
        order
      })
    } catch (err) {
      next(err)
    }
  }
)

// POST /api/payments/:id/verify — called after the (test-mode) checkout
// completes. Verifies the gateway signature server-side before ever
// marking anything Paid — the frontend cannot mark a payment as
// successful on its own.
router.post(
  '/:id/verify',
  [
    param('id').isInt(),
    body('gatewayPaymentId').isString().notEmpty(),
    body('signature').isString().notEmpty()
  ],
  validate,
  (req, res) => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })
    if (payment.status === 'Paid') return res.json({ payment: serializePayment(payment) })

    const isOwner =
      req.user.role === 'admin' ||
      (req.user.role === 'customer' &&
        db.prepare('SELECT customer_id FROM projects WHERE id = ?').get(payment.project_id)?.customer_id === req.user.customer_id)
    if (!isOwner) return res.status(403).json({ error: 'You cannot verify this payment.' })

    const { gatewayPaymentId, signature } = req.body
    const validSignature = verifySignature({ orderId: payment.gateway_order_id, paymentId: gatewayPaymentId, signature })
    if (!validSignature) {
      db.prepare("UPDATE payments SET status = 'Failed', updated_at = datetime('now') WHERE id = ?").run(payment.id)
      return res.status(400).json({ error: 'Payment verification failed. The signature did not match.' })
    }

    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      "UPDATE payments SET status = 'Paid', payment_date = ?, transaction_id = ?, gateway_payment_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(today, transactionId, gatewayPaymentId, payment.id)

    res.json({ payment: serializePayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id)) })
  }
)

// POST /api/payments/:id/mock-confirm — used ONLY when the payment was
// created against the offline mock gateway (no real Razorpay keys
// configured). There is no third-party signature to check in that case,
// so this endpoint is the mock equivalent of "the gateway told us it
// succeeded" — still guarded by ownership/role and by requiring the
// payment to actually be a 'mock' gateway order, so it can never be used
// to rubber-stamp a real Razorpay payment.
router.post('/:id/mock-confirm', [param('id').isInt()], validate, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found.' })
  if (payment.gateway !== 'mock') {
    return res.status(400).json({ error: 'This payment is not on the mock gateway.' })
  }
  if (payment.status === 'Paid') return res.json({ payment: serializePayment(payment) })

  const isOwner =
    req.user.role === 'admin' ||
    (req.user.role === 'customer' &&
      db.prepare('SELECT customer_id FROM projects WHERE id = ?').get(payment.project_id)?.customer_id === req.user.customer_id)
  if (!isOwner) return res.status(403).json({ error: 'You cannot confirm this payment.' })

  const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const today = new Date().toISOString().slice(0, 10)
  db.prepare(
    "UPDATE payments SET status = 'Paid', payment_date = ?, transaction_id = ?, gateway_payment_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(today, transactionId, `mock_pay_${crypto.randomBytes(6).toString('hex')}`, payment.id)

  res.json({ payment: serializePayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id)) })
})

// POST /api/payments/record — admin manually logging an offline payment
// (bank transfer / cash), mirroring the original "Record Payment" modal.
router.post(
  '/record',
  requireRole('admin'),
  [
    body('projectId').isInt(),
    body('amount').isFloat({ gt: 0 }),
    body('method').isIn(['Bank Transfer', 'UPI', 'Credit Card', 'Cash']),
    body('dueDate').optional().isISO8601()
  ],
  validate,
  (req, res) => {
    const { projectId, amount, method, dueDate } = req.body
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    if (!project) return res.status(404).json({ error: 'Project not found.' })

    const invoiceCount = db.prepare('SELECT COUNT(*) AS n FROM payments').get().n
    const invoiceId = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(3, '0')}`
    const today = new Date().toISOString().slice(0, 10)
    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    const info = db
      .prepare(
        `INSERT INTO payments (invoice_id, project_id, customer_name, project_name, amount, currency, method, payment_date, due_date, status, transaction_id, gateway, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, 'Paid', ?, 'manual', ?)`
      )
      .run(invoiceId, project.id, project.customer_name, project.name, amount, method, today, dueDate || today, transactionId, req.user.id)

    res.status(201).json({ payment: serializePayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid)) })
  }
)

export default router
