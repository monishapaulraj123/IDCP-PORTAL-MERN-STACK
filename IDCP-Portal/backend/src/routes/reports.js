import { Router } from 'express'
import { db } from '../db/index.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

// Monthly paid-revenue totals, computed straight from the payments table
// (real DB aggregation, not a hard-coded array) for the last 8 calendar
// months that have data, in lakhs (₹100,000) to match the existing chart.
router.get('/revenue-trend', (req, res) => {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', payment_date) AS ym, SUM(amount) AS total
       FROM payments
       WHERE status = 'Paid' AND payment_date IS NOT NULL
       GROUP BY ym
       ORDER BY ym ASC`
    )
    .all()

  const trend = rows.map((r) => {
    const [year, month] = r.ym.split('-')
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
    return { month: label, value: Math.round((r.total / 100000) * 10) / 10 }
  })

  res.json({ trend })
})

router.get('/customer-growth', (req, res) => {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS n
       FROM customers GROUP BY ym ORDER BY ym ASC`
    )
    .all()
  const growth = rows.map((r) => {
    const [year, month] = r.ym.split('-')
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
    return { month: label, value: r.n }
  })
  res.json({ growth })
})

export default router
