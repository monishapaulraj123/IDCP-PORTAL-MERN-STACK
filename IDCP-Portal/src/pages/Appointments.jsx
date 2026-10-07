import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  MdOutlineEventAvailable,
  MdOutlineUpcoming,
  MdOutlineCheckCircle,
  MdOutlineCancel,
  MdAdd,
  MdClose,
  MdOutlineSearch,
  MdChevronLeft,
  MdChevronRight,
  MdOutlinePerson,
  MdOutlineBadge,
  MdOutlineAccessTime,
  MdOutlineLocationOn
} from 'react-icons/md'
import { ThemeContext } from '../context/ThemeContext.jsx'
import { AuthContext } from '../context/AuthContext.jsx'
import { DataContext } from '../context/DataContext.jsx'
import SummaryCard from '../components/SummaryCard.jsx'

const STATUS_CLASS = {
  Confirmed: 'status-active',
  Pending: 'status-inactive',
  Completed: 'status-completed',
  Cancelled: 'status-inactive',
  Rejected: 'status-inactive',
  Rescheduled: 'status-inactive'
}

const EMPTY_FORM = { projectId: '', designer: '', date: '', time: '', mode: 'In Person', tag: '' }

function isSameDay(isoDate, year, month, day) {
  const d = new Date(isoDate)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function Appointments() {
  // useContext: shared language strings, theme, the logged-in user, and
  // the shared appointments/projects/designers lists. Appointments are
  // already role-scoped SERVER-SIDE (a customer's GET /api/appointments
  // only ever returns their own project's appointments, a designer's
  // only their own) — so what lands in `appointments` here is already
  // exactly what this user is allowed to see.
  const { t } = useContext(ThemeContext)
  const { user } = useContext(AuthContext)
  const {
    projects, designers, appointments,
    addAppointment, updateAppointmentStatus, getAppointmentAvailability
  } = useContext(DataContext)

  const [activeFilter, setActiveFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [actionError, setActionError] = useState('')
  const searchInputRef = useRef(null)

  const today = todayIso()

  // Fetches real, backend-validated available slots for the chosen
  // designer + date (blocks past times and already-booked slots) any
  // time either changes — this is what "show available slots, backend
  // validates availability" means in practice.
  useEffect(() => {
    if (!form.designer || !form.date) {
      setAvailableSlots([])
      return
    }
    setIsLoadingSlots(true)
    getAppointmentAvailability(form.designer, form.date)
      .then((res) => setAvailableSlots(res.slots))
      .catch(() => setAvailableSlots([]))
      .finally(() => setIsLoadingSlots(false))
  }, [form.designer, form.date, getAppointmentAvailability])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value, ...(name === 'designer' || name === 'date' ? { time: '' } : {}) }))
  }

  const handleResetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setFormError('')
    setAvailableSlots([])
    setIsModalOpen(false)
  }, [])

  // Books the appointment through the backend, which re-validates the
  // slot server-side (past date, business hours, and double-booking) even
  // though we already only show open slots in the UI — never trusting
  // client-side state alone.
  const handleScheduleAppointment = useCallback(
    async (e) => {
      e.preventDefault()
      setFormError('')
      const project = projects.find((p) => String(p.id) === String(form.projectId))
      if (!project || !form.date || !form.time) {
        setFormError('Please choose a project, date, and time slot.')
        return
      }
      setIsSubmitting(true)
      try {
        await addAppointment({
          projectId: project.id,
          designer: form.designer || project.designer,
          date: form.date,
          time: form.time,
          mode: form.mode,
          tag: form.tag || 'Project Discussion'
        })
        handleResetForm()
      } catch (err) {
        setFormError(err.message || 'Could not book this appointment.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [form, handleResetForm, projects, addAppointment]
  )

  const handleSearchFocus = useCallback(() => {
    searchInputRef.current?.focus()
  }, [])

  const canManage = user?.role === 'admin' || user?.role === 'designer'

  const handleStatusChange = useCallback(
    async (appointmentId, status) => {
      setActionError('')
      try {
        await updateAppointmentStatus(appointmentId, status)
      } catch (err) {
        setActionError(err.message || 'Could not update this appointment.')
      }
    },
    [updateAppointmentStatus]
  )

  // useMemo: filtered + searched appointment list.
  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter((a) => {
          const term = searchTerm.trim().toLowerCase()
          return (
            term === '' ||
            a.customerName.toLowerCase().includes(term) ||
            a.projectName.toLowerCase().includes(term) ||
            a.designer.toLowerCase().includes(term)
          )
        })
        .filter((a) => {
          if (activeFilter === 'all') return true
          if (activeFilter === 'today') return a.date === today
          return a.status.toLowerCase() === activeFilter
        })
        .sort((a, b) => new Date(`${a.date}T00:00`) - new Date(`${b.date}T00:00`)),
    [appointments, searchTerm, activeFilter, today]
  )

  const stats = useMemo(
    () => ({
      today: appointments.filter((a) => a.date === today).length,
      upcoming: appointments.filter((a) => new Date(a.date) >= new Date(today) && !['Cancelled', 'Rejected', 'Completed'].includes(a.status)).length,
      completed: appointments.filter((a) => a.status === 'Completed').length,
      cancelled: appointments.filter((a) => a.status === 'Cancelled' || a.status === 'Rejected').length
    }),
    [appointments, today]
  )

  // useMemo: calendar grid cells for the currently viewed month, with a
  // flag for whether any appointment falls on that day (drives the dot).
  const calendarCells = useMemo(() => {
    const year = calendarCursor.getFullYear()
    const month = calendarCursor.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells = []
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, muted: true })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const hasAppointment = appointments.some((a) => isSameDay(a.date, year, month, day))
      cells.push({ day, muted: false, hasAppointment })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: cells.length, muted: true })
    }
    return cells
  }, [calendarCursor, appointments])

  const handlePrevMonth = useCallback(() => {
    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])
  const handleNextMonth = useCallback(() => {
    setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const monthLabel = calendarCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div>
          <h2>{t.appointmentsPageTitle}</h2>
          <p>{t.appointmentsPageSubtitle}</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <MdAdd /> {t.scheduleAppointment}
        </button>
      </div>

      <div className="summary-grid">
        <SummaryCard icon={<MdOutlineEventAvailable />} value={stats.today} label={t.todaysAppointments} />
        <SummaryCard icon={<MdOutlineUpcoming />} value={stats.upcoming} label={t.upcoming} trend="+7.5%" />
        <SummaryCard icon={<MdOutlineCheckCircle />} value={stats.completed} label={t.completed} trend="+12.8%" />
        <SummaryCard icon={<MdOutlineCancel />} value={stats.cancelled} label={t.cancelled} />
      </div>

      <div className="appointments-layout">
        <div className="directory-panel">
          <div className="directory-header">
            <h3>{t.appointmentSchedule}</h3>
            <div className="directory-search" onClick={handleSearchFocus}>
              <MdOutlineSearch />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t.searchAppointments}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-tabs">
            {[
              { key: 'all', label: t.allAppointments || 'All Appointments' },
              { key: 'today', label: t.today || 'Today' },
              { key: 'pending', label: t.pending || 'Pending' },
              { key: 'confirmed', label: t.confirmed },
              { key: 'completed', label: t.completed },
              { key: 'cancelled', label: t.cancelled }
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

          {actionError && <div className="form-error" style={{ margin: '0 20px 12px' }}>{actionError}</div>}

          {filteredAppointments.length === 0 ? (
            <div className="empty-state">{t.emptyState}</div>
          ) : (
            <div className="customer-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {filteredAppointments.map((a) => (
                <div className="customer-card" key={a.id}>
                  <div className="customer-card-body" style={{ paddingTop: 20 }}>
                    <div className="customer-card-title-row">
                      <div>
                        <div className="customer-name">{a.customerName}</div>
                        <div className="customer-id">{a.projectName}</div>
                      </div>
                      <span className={`status-pill ${STATUS_CLASS[a.status] || 'status-active'}`}>
                        {t[a.status] || a.status}
                      </span>
                    </div>
                    <ul className="customer-meta-list">
                      <li><MdOutlineBadge /> {a.designer}</li>
                      <li><MdOutlineAccessTime /> {new Date(a.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · {a.time}</li>
                      <li><MdOutlineLocationOn /> {a.location}</li>
                    </ul>
                    <span className="current-stage-chip">{a.tag}</span>

                    {/* Designer/admin: confirm, reject or complete a pending/confirmed
                        appointment. Customer: cancel their own. Backend re-checks
                        every one of these transitions against role + ownership. */}
                    <div className="customer-card-footer" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                      {canManage && (a.status === 'Pending' || a.status === 'Rescheduled') && (
                        <>
                          <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleStatusChange(a.id, 'Confirmed')}>
                            {t.confirm || 'Confirm'}
                          </button>
                          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleStatusChange(a.id, 'Rejected')}>
                            {t.reject || 'Reject'}
                          </button>
                        </>
                      )}
                      {canManage && a.status === 'Confirmed' && (
                        <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleStatusChange(a.id, 'Completed')}>
                          {t.markCompleted || 'Mark Completed'}
                        </button>
                      )}
                      {(user?.role === 'customer' || canManage) && ['Pending', 'Confirmed', 'Rescheduled'].includes(a.status) && (
                        <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleStatusChange(a.id, 'Cancelled')}>
                          {t.cancel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mini-calendar">
          <div className="mini-calendar-header">
            <h4>{monthLabel}</h4>
            <div className="mini-calendar-nav">
              <button type="button" onClick={handlePrevMonth} aria-label="Previous month"><MdChevronLeft /></button>
              <button type="button" onClick={handleNextMonth} aria-label="Next month"><MdChevronRight /></button>
            </div>
          </div>
          <div className="mini-calendar-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div className="mini-calendar-dow" key={`${d}-${i}`}>{d}</div>
            ))}
            {calendarCells.map((cell, idx) => (
              <div
                key={idx}
                className={`mini-calendar-cell${cell.muted ? ' is-muted' : ''}${cell.hasAppointment ? ' has-appointment' : ''}${selectedDay === cell.day && !cell.muted ? ' is-selected' : ''}`}
                onClick={() => !cell.muted && setSelectedDay(cell.day)}
              >
                {cell.day}
              </div>
            ))}
          </div>
          <div className="mini-calendar-legend">
            <span><span className="legend-dot" /> {t.hasAppointmentsLabel || 'Has appointments'}</span>
            <span><span className="legend-dot selected" /> {t.selectedDayLabel || 'Selected day'}</span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleResetForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.scheduleAppointment}</h3>
              <button className="modal-close" onClick={handleResetForm} aria-label={t.closeModal}>
                <MdClose />
              </button>
            </div>
            <form onSubmit={handleScheduleAppointment}>
              <div className="form-grid">
                <div className="form-field full-width">
                  <label><MdOutlinePerson /> Project</label>
                  <select name="projectId" value={form.projectId} onChange={handleFormChange} required>
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>{t.designerLabel}</label>
                  <select name="designer" value={form.designer} onChange={handleFormChange} required>
                    <option value="">—</option>
                    {designers.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Mode</label>
                  <select name="mode" value={form.mode} onChange={handleFormChange}>
                    <option value="In Person">In Person</option>
                    <option value="Virtual Meeting">Virtual Meeting</option>
                    <option value="Site Visit">Site Visit</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Date</label>
                  <input type="date" name="date" min={today} value={form.date} onChange={handleFormChange} required />
                </div>
                <div className="form-field">
                  <label>Available Time Slots</label>
                  {/* Real, backend-computed availability: booked slots and
                      past times for the selected date are disabled here,
                      and the booking itself is re-validated server-side. */}
                  <select name="time" value={form.time} onChange={handleFormChange} required disabled={!form.designer || !form.date}>
                    <option value="">{isLoadingSlots ? 'Loading slots…' : '—'}</option>
                    {availableSlots.map((slot) => (
                      <option key={slot.time} value={slot.time} disabled={!slot.available}>
                        {slot.label}{!slot.available ? ' (booked)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field full-width">
                  <label>Purpose</label>
                  <input type="text" name="tag" value={form.tag} onChange={handleFormChange} placeholder="Design Review" />
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleResetForm}>{t.cancel}</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? '...' : t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
