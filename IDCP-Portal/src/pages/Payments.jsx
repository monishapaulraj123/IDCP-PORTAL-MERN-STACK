import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  MdOutlineCurrencyRupee,
  MdOutlineHourglassEmpty,
  MdOutlineCheckCircle,
  MdOutlineErrorOutline,
  MdAdd,
  MdClose,
  MdOutlineLock,
  MdOutlinePayments
} from 'react-icons/md'
import { ThemeContext } from '../context/ThemeContext.jsx'
import { AuthContext } from '../context/AuthContext.jsx'
import { DataContext } from '../context/DataContext.jsx'
import SummaryCard from '../components/SummaryCard.jsx'

const STATUS_CLASS = {
  Paid: 'status-active',
  Pending: 'status-inactive',
  Overdue: 'status-inactive',
  Failed: 'status-inactive'
}

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}
function formatLakh(amount) {
  return `₹${(amount / 100000).toFixed(1)}L`
}
function formatDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

const EMPTY_FORM = { projectId: '', amount: '', method: 'Bank Transfer', dueDate: '' }
const EMPTY_PAY_FORM = { projectId: '', amount: '', method: 'UPI' }

// This modal is the "existing payment button opens a payment page/modal"
// flow: it shows the project + amount, then walks through the same
// order -> checkout -> verify steps a real gateway integration uses.
// When the backend is running with real RAZORPAY_KEY_ID/SECRET, this
// would hand off to Razorpay's Checkout.js using `order.id` +
// `gatewayKeyId`; since sandbox/test credentials are optional (see
// backend/.env.example), the backend automatically falls back to a
// built-in mock gateway, and this modal renders the equivalent
// test-mode confirmation screen instead — same order/verify contract
// either way. No card number or CVV is ever collected or sent here.
function CheckoutModal({ order, gateway, onClose, onConfirmMock, onDone, isConfirming, error }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><MdOutlineLock style={{ verticalAlign: -2 }} /> Secure Checkout</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <MdClose />
          </button>
        </div>
        <div style={{ padding: '4px 4px 20px' }}>
          <div className="workflow-chip-row" style={{ marginBottom: 16 }}>
            <span className="workflow-chip"><strong>Project:</strong> {order.projectName}</span>
            <span className="workflow-chip"><strong>Invoice:</strong> {order.invoiceId}</span>
          </div>
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Amount payable</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{formatCurrency(order.amount)}</div>
          </div>

          {gateway === 'mock' ? (
            <>
              <div className="form-error" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                Sandbox / test mode — no real gateway keys configured. This simulates a
                successful UPI/card payment without collecting or storing any real card
                details. Add RAZORPAY_KEY_ID/SECRET to backend/.env to use real Razorpay
                test mode instead.
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="btn-primary" onClick={onConfirmMock} disabled={isConfirming}>
                  {isConfirming ? 'Confirming…' : 'Simulate Test Payment'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                A Razorpay TEST-mode checkout window will open. Use any Razorpay test
                card/UPI ID — no real money moves.
              </p>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="btn-primary" onClick={onDone} disabled={isConfirming}>
                  {isConfirming ? 'Opening…' : 'Pay with Razorpay (Test Mode)'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Payments() {
  const { t } = useContext(ThemeContext)
  const { user } = useContext(AuthContext)
  const {
    projects, payments, revenueTrend,
    createPaymentOrder, mockConfirmPayment, verifyPayment, recordManualPayment
  } = useContext(DataContext)

  const [activeFilter, setActiveFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [isStartPayOpen, setIsStartPayOpen] = useState(false)
  const [payForm, setPayForm] = useState(EMPTY_PAY_FORM)
  const [activeOrder, setActiveOrder] = useState(null) // { payment, gateway, gatewayKeyId, order }
  const [isConfirming, setIsConfirming] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }
  const handleResetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setIsModalOpen(false)
  }, [])

  // Admin-only: logs an already-settled offline payment (bank transfer,
  // cash, etc.) straight into the ledger.
  const handleRecordPayment = useCallback(
    async (e) => {
      e.preventDefault()
      if (!form.projectId || !form.amount) return
      try {
        await recordManualPayment({
          projectId: Number(form.projectId),
          amount: Number(form.amount),
          method: form.method,
          dueDate: form.dueDate || undefined
        })
        handleResetForm()
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert(err.message)
      }
    },
    [form, handleResetForm, recordManualPayment]
  )

  const handlePayFormChange = (e) => {
    const { name, value } = e.target
    setPayForm((prev) => ({ ...prev, [name]: value }))
  }

  // "Pay Now" — the existing payment button opens this modal. Starts a
  // real order on the backend (amount is fixed server-side from here on).
  const handleStartPayment = useCallback(
    async (e) => {
      e.preventDefault()
      const project = projects.find((p) => String(p.id) === String(payForm.projectId))
      if (!project || !payForm.amount) return
      setCheckoutError('')
      try {
        const result = await createPaymentOrder({
          projectId: project.id,
          amount: Number(payForm.amount),
          method: payForm.method
        })
        setActiveOrder(result)
        setIsPayModalOpen(true)
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert(err.message)
      }
    },
    [payForm, projects, createPaymentOrder]
  )

  // Also usable directly from an existing Pending invoice row.
  const handlePayExisting = useCallback(
    async (payment) => {
      setCheckoutError('')
      try {
        const result = await createPaymentOrder({
          projectId: payment.projectId,
          amount: payment.amount,
          method: payment.method || 'UPI'
        })
        setActiveOrder(result)
        setIsPayModalOpen(true)
      } catch (err) {
        setCheckoutError(err.message)
      }
    },
    [createPaymentOrder]
  )

  const handleConfirmMock = useCallback(async () => {
    if (!activeOrder) return
    setIsConfirming(true)
    setCheckoutError('')
    try {
      await mockConfirmPayment(activeOrder.payment.id)
      setIsPayModalOpen(false)
      setActiveOrder(null)
      setIsModalOpen(false)
      setPayForm(EMPTY_PAY_FORM)
    } catch (err) {
      setCheckoutError(err.message || 'Payment could not be confirmed.')
    } finally {
      setIsConfirming(false)
    }
  }, [activeOrder, mockConfirmPayment])

  // Real Razorpay path: loads Checkout.js and opens it with the order
  // returned from the backend, then verifies the signature server-side.
  const handleRazorpayCheckout = useCallback(() => {
    if (!activeOrder) return
    setIsConfirming(true)
    setCheckoutError('')

    const openCheckout = () => {
      const options = {
        key: activeOrder.gatewayKeyId,
        amount: activeOrder.order.amount,
        currency: activeOrder.order.currency,
        order_id: activeOrder.order.id,
        name: 'IDCP Portal',
        description: activeOrder.payment.projectName,
        handler: async (response) => {
          try {
            await verifyPayment(
              activeOrder.payment.id,
              response.razorpay_payment_id,
              response.razorpay_signature
            )
            setIsPayModalOpen(false)
            setActiveOrder(null)
          } catch (err) {
            setCheckoutError(err.message || 'Verification failed.')
          } finally {
            setIsConfirming(false)
          }
        },
        modal: { ondismiss: () => setIsConfirming(false) },
        theme: { color: '#7c5cff' }
      }
      // eslint-disable-next-line no-undef
      const rzp = new window.Razorpay(options)
      rzp.open()
    }

    if (window.Razorpay) {
      openCheckout()
    } else {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = openCheckout
      script.onerror = () => {
        setCheckoutError('Could not load the Razorpay checkout script.')
        setIsConfirming(false)
      }
      document.body.appendChild(script)
    }
  }, [activeOrder, verifyPayment])

  const roleScopedPayments = payments // already role-scoped by the backend

  const filteredPayments = useMemo(
    () =>
      roleScopedPayments.filter((p) => {
        if (activeFilter === 'all') return true
        return p.status.toLowerCase() === activeFilter
      }),
    [roleScopedPayments, activeFilter]
  )

  const stats = useMemo(() => {
    const paid = roleScopedPayments.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0)
    const pending = roleScopedPayments.filter((p) => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0)
    const overdue = roleScopedPayments.filter((p) => p.status === 'Overdue').reduce((sum, p) => sum + p.amount, 0)
    return { paid, pending, overdue, total: paid + pending + overdue }
  }, [roleScopedPayments])

  const maxRevenue = useMemo(() => Math.max(1, ...revenueTrend.map((m) => m.value)), [revenueTrend])

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div>
          <h2>{t.paymentsPageTitle}</h2>
          <p>{t.paymentsPageSubtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {user?.role === 'customer' && (
            <button className="btn-primary" onClick={() => setIsStartPayOpen(true)}>
              <MdOutlinePayments /> Pay Now
            </button>
          )}
          {user?.role === 'admin' && (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <MdAdd /> {t.recordPayment}
            </button>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <SummaryCard icon={<MdOutlineCurrencyRupee />} value={formatLakh(stats.total)} label={t.totalRevenue} trend="+14.8%" />
        <SummaryCard icon={<MdOutlineHourglassEmpty />} value={formatLakh(stats.pending)} label={t.pendingPayments} />
        <SummaryCard icon={<MdOutlineCheckCircle />} value={formatLakh(stats.paid)} label={t.paidLabel} trend="+11.2%" />
        <SummaryCard icon={<MdOutlineErrorOutline />} value={formatLakh(stats.overdue)} label={t.overdueLabel} />
      </div>

      <div className="chart-grid-2">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <h3>{t.revenueTrend}</h3>
              <p>{t.revenueTrendSubtitle}</p>
            </div>
          </div>
          <div className="bar-chart">
            {revenueTrend.length === 0 ? (
              <div className="empty-state">{t.emptyState}</div>
            ) : (
              revenueTrend.map((m, idx) => (
                <div className="bar-chart-col" key={m.month}>
                  <div
                    className={`bar-chart-bar${idx >= revenueTrend.length - 2 ? ' is-highlight' : ''}`}
                    style={{ height: `${(m.value / maxRevenue) * 100}%` }}
                    title={`₹${m.value}L`}
                  />
                  <span className="bar-chart-label">{m.month}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>{t.paymentBreakdown}</h3>
          </div>
          <div className="breakdown-row">
            <span className="breakdown-row-label"><span className="legend-dot" /> {t.paidLabel}</span>
            <span className="breakdown-row-value">{formatLakh(stats.paid)}</span>
          </div>
          <div className="horizontal-bar-track" style={{ marginBottom: 14 }}>
            <div className="horizontal-bar-fill" style={{ width: `${stats.total ? (stats.paid / stats.total) * 100 : 0}%` }} />
          </div>
          <div className="breakdown-row">
            <span className="breakdown-row-label"><span className="legend-dot selected" /> {t.pending}</span>
            <span className="breakdown-row-value">{formatLakh(stats.pending)}</span>
          </div>
          <div className="horizontal-bar-track" style={{ marginBottom: 14 }}>
            <div className="horizontal-bar-fill gold" style={{ width: `${stats.total ? (stats.pending / stats.total) * 100 : 0}%` }} />
          </div>
          <div className="breakdown-row">
            <span className="breakdown-row-label">{t.overdueLabel}</span>
            <span className="breakdown-row-value">{formatLakh(stats.overdue)}</span>
          </div>
          <div className="breakdown-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 4 }}>
            <span className="breakdown-row-label">{t.totalInvoiced}</span>
            <span className="breakdown-row-value">{formatLakh(stats.total)}</span>
          </div>
        </div>
      </div>

      <div className="directory-panel">
        <div className="directory-header">
          <h3>{t.paymentTransactions}</h3>
        </div>
        <div className="filter-tabs">
          {[
            { key: 'all', label: t.allPayments || 'All Payments' },
            { key: 'paid', label: t.paidLabel },
            { key: 'pending', label: t.pending },
            { key: 'overdue', label: t.overdueLabel }
          ].map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab${activeFilter === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.invoiceLabel}</th>
                <th>{t.customerLabel} / {t.projectLabel || 'Project'}</th>
                <th>{t.amountLabel}</th>
                <th>{t.methodLabel}</th>
                <th>{t.paymentDateLabel}</th>
                <th>{t.statusLabel}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.emptyState}</td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.invoiceId}
                      {p.transactionId && <div className="table-cell-subtitle">{p.transactionId}</div>}
                    </td>
                    <td>
                      {p.customerName}
                      <div className="table-cell-subtitle">{p.projectName}</div>
                    </td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{p.method || '—'}</td>
                    <td>
                      {formatDate(p.paymentDate)}
                      <div className="table-cell-subtitle">Due {formatDate(p.dueDate)}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_CLASS[p.status] || 'status-active'}`}>{t[p.status] || p.status}</span>
                    </td>
                    <td>
                      {(user?.role === 'customer' || user?.role === 'admin') && (p.status === 'Pending' || p.status === 'Overdue') && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                          onClick={() => handlePayExisting(p)}
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer "Pay Now" entry point: pick a project + amount, then
          hand off to the same checkout modal used for existing invoices. */}
      {isStartPayOpen && (
        <div className="modal-overlay" onClick={() => setIsStartPayOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><MdOutlinePayments style={{ verticalAlign: -2 }} /> Pay Now</h3>
              <button className="modal-close" onClick={() => setIsStartPayOpen(false)} aria-label={t.closeModal}>
                <MdClose />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                await handleStartPayment(e)
                setIsStartPayOpen(false)
              }}
            >
              <div className="form-grid">
                <div className="form-field full-width">
                  <label>Project</label>
                  <select name="projectId" value={payForm.projectId} onChange={handlePayFormChange} required>
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>{t.amountLabel}</label>
                  <input type="number" name="amount" min="1" value={payForm.amount} onChange={handlePayFormChange} required />
                </div>
                <div className="form-field">
                  <label>{t.methodLabel}</label>
                  <select name="method" value={payForm.method} onChange={handlePayFormChange}>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Net Banking">Net Banking</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsStartPayOpen(false)}>{t.cancel}</button>
                <button type="submit" className="btn-primary">Continue to Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleResetForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.recordPayment}</h3>
              <button className="modal-close" onClick={handleResetForm} aria-label={t.closeModal}>
                <MdClose />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="form-grid">
                <div className="form-field full-width">
                  <label>Project</label>
                  <select name="projectId" value={form.projectId} onChange={handleFormChange} required>
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>{t.amountLabel}</label>
                  <input type="number" name="amount" min="0" value={form.amount} onChange={handleFormChange} required />
                </div>
                <div className="form-field">
                  <label>{t.methodLabel}</label>
                  <select name="method" value={form.method} onChange={handleFormChange}>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Due Date</label>
                  <input type="date" name="dueDate" value={form.dueDate} onChange={handleFormChange} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleResetForm}>{t.cancel}</button>
                <button type="submit" className="btn-primary">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPayModalOpen && activeOrder && (
        <CheckoutModal
          order={activeOrder.payment}
          gateway={activeOrder.gateway}
          error={checkoutError}
          isConfirming={isConfirming}
          onClose={() => {
            setIsPayModalOpen(false)
            setActiveOrder(null)
            setCheckoutError('')
          }}
          onConfirmMock={handleConfirmMock}
          onDone={handleRazorpayCheckout}
        />
      )}
    </div>
  )
}
