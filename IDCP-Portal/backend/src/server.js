import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { runMigrations } from './db/index.js'
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js'

import authRoutes from './routes/auth.js'
import customerRoutes from './routes/customers.js'
import projectRoutes from './routes/projects.js'
import designerRoutes from './routes/designers.js'
import contractorRoutes from './routes/contractors.js'
import supplierRoutes from './routes/suppliers.js'
import materialRoutes from './routes/materials.js'
import quotationRoutes from './routes/quotations.js'
import appointmentRoutes from './routes/appointments.js'
import paymentRoutes from './routes/payments.js'
import reportRoutes from './routes/reports.js'

runMigrations()

const app = express()
const PORT = process.env.PORT || 4000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    origin: FRONTEND_URL.split(',').map((s) => s.trim()),
    credentials: true
  })
)
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// A generous global rate limit as defense-in-depth; individual routes
// (e.g. login) layer stricter limits on top of this.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false
  })
)

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'idcp-portal-backend' }))

app.use('/api/auth', authRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/designers', designerRoutes)
app.use('/api/contractors', contractorRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/quotations', quotationRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports', reportRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`IDCP backend listening on http://localhost:${PORT}`)
  console.log(`CORS allowed origin(s): ${FRONTEND_URL}`)
})
