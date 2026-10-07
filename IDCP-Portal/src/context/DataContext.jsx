import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api.js'
import { AuthContext } from './AuthContext.jsx'
import { getImageForProjectType, getImageForProject, getImageByIndex } from '../assets/images/index.js'

// Single source of truth for every entity list across the WHOLE app,
// same role this context played before — except every list here now
// comes from the backend/database instead of the static sampleData.js
// file. Pages read/write through this context exactly like before; only
// the data source underneath changed.
export const DataContext = createContext(null)

export const PROJECT_STAGES = [
  'Consultation', 'Site Measurement', 'Requirement Analysis', 'Design', '3D Visualization',
  'Design Approval', 'Quotation', 'Material Selection', 'Procurement', 'Execution',
  'Installation', 'Quality Inspection', 'Final Handover', 'Completed'
]

export function DataProvider({ children }) {
  const { isAuthenticated, user } = useContext(AuthContext)

  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [designers, setDesigners] = useState([])
  const [contractors, setContractors] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])
  const [quotations, setQuotations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [payments, setPayments] = useState([])
  const [revenueTrend, setRevenueTrend] = useState([])
  const [customerGrowth, setCustomerGrowth] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const refreshProjects = useCallback(() => {
    return api.get('/projects').then((r) =>
      setProjects(r.projects.map((p) => ({ ...p, image: getImageForProject(p.projectType) })))
    )
  }, [])
  const refreshAppointments = useCallback(() => {
    return api.get('/appointments').then((r) => setAppointments(r.appointments))
  }, [])
  const refreshPayments = useCallback(() => {
    // Payments API is admin/customer only — designers/contractors simply
    // won't have anything to show on that page (route is already
    // restricted to admin/customer in App.jsx too).
    return api
      .get('/payments')
      .then((r) => setPayments(r.payments))
      .catch(() => setPayments([]))
  }, [])
  const refreshQuotations = useCallback(() => {
    return api
      .get('/quotations')
      .then((r) => setQuotations(r.quotations))
      .catch(() => setQuotations([]))
  }, [])
  const refreshCustomers = useCallback(() => {
    return api
      .get('/customers')
      .then((r) => setCustomers(r.customers.map((c) => ({ ...c, photo: getImageForProjectType(c.projectType) }))))
      .catch(() => setCustomers([]))
  }, [])

  // Once logged in, load every list this session's role can see. Each
  // call is independently caught so one 403 (e.g. a contractor hitting
  // /customers) doesn't block the rest of the dashboard from loading.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setCustomers([]); setProjects([]); setDesigners([]); setContractors([])
      setSuppliers([]); setMaterials([]); setQuotations([]); setAppointments([])
      setPayments([]); setRevenueTrend([])
      return
    }
    setIsLoading(true)
    Promise.allSettled([
      refreshCustomers(),
      refreshProjects(),
      api.get('/designers').then((r) => setDesigners(r.designers.map((d) => ({ ...d, photo: getImageByIndex(d.id) })))),
      api.get('/contractors').then((r) => setContractors(r.contractors.map((c) => ({ ...c, photo: getImageByIndex(c.id) })))),
      api.get('/suppliers').then((r) => setSuppliers(r.suppliers.map((s) => ({ ...s, photo: getImageByIndex(s.id) })))),
      api.get('/materials').then((r) => setMaterials(r.materials)).catch(() => setMaterials([])),
      refreshQuotations(),
      refreshAppointments(),
      refreshPayments(),
      api.get('/reports/revenue-trend').then((r) => setRevenueTrend(r.trend)).catch(() => setRevenueTrend([])),
      api.get('/reports/customer-growth').then((r) => setCustomerGrowth(r.growth)).catch(() => setCustomerGrowth([]))
    ]).finally(() => setIsLoading(false))
  }, [isAuthenticated, user, refreshCustomers, refreshProjects, refreshQuotations, refreshAppointments, refreshPayments])

  const addCustomer = useCallback(async (customer) => {
    const { customer: created } = await api.post('/customers', customer)
    setCustomers((prev) => [created, ...prev])
    return created
  }, [])

  const deleteCustomer = useCallback(async (id) => {
    await api.delete(`/customers/${id}`)
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const addProject = useCallback(async (project) => {
    const { project: created } = await api.post('/projects', project)
    setProjects((prev) => [created, ...prev])
    return created
  }, [])

  const advanceProjectStage = useCallback(async (projectId) => {
    const { project: updated } = await api.patch(`/projects/${projectId}/advance`)
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
  }, [])

  const revertProjectStage = useCallback(async (projectId) => {
    const { project: updated } = await api.patch(`/projects/${projectId}/revert`)
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
  }, [])

  const addSupplier = useCallback(async (supplier) => {
    const { supplier: created } = await api.post('/suppliers', supplier)
    const withPhoto = { ...created, photo: getImageByIndex(created.id) }
    setSuppliers((prev) => [withPhoto, ...prev])
    return withPhoto
  }, [])

  const addMaterial = useCallback(async (material) => {
    const { material: created } = await api.post('/materials', material)
    setMaterials((prev) => [created, ...prev])
    return created
  }, [])

  const addQuotation = useCallback(async (quotation) => {
    const { quotation: created } = await api.post('/quotations', quotation)
    setQuotations((prev) => [created, ...prev])
    return created
  }, [])

  const addAppointment = useCallback(async (appointment) => {
    const { appointment: created } = await api.post('/appointments', appointment)
    setAppointments((prev) => [created, ...prev])
    return created
  }, [])

  const updateAppointmentStatus = useCallback(async (id, status) => {
    const { appointment: updated } = await api.patch(`/appointments/${id}/status`, { status })
    setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)))
    return updated
  }, [])

  const rescheduleAppointment = useCallback(async (id, date, time) => {
    const { appointment: updated } = await api.patch(`/appointments/${id}/reschedule`, { date, time })
    setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)))
    return updated
  }, [])

  const getAppointmentAvailability = useCallback((designer, date) => {
    return api.get(`/appointments/availability?designer=${encodeURIComponent(designer)}&date=${encodeURIComponent(date)}`)
  }, [])

  // Payment flow: create order -> (real gateway checkout OR mock
  // confirm) -> verify. Each step hits the backend; nothing here ever
  // marks a payment Paid on its own.
  const createPaymentOrder = useCallback(async (payload) => {
    const result = await api.post('/payments/order', payload)
    setPayments((prev) => [result.payment, ...prev])
    return result
  }, [])

  const verifyPayment = useCallback(async (paymentId, gatewayPaymentId, signature) => {
    const { payment: updated } = await api.post(`/payments/${paymentId}/verify`, { gatewayPaymentId, signature })
    setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)))
    return updated
  }, [])

  const mockConfirmPayment = useCallback(async (paymentId) => {
    const { payment: updated } = await api.post(`/payments/${paymentId}/mock-confirm`)
    setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)))
    return updated
  }, [])

  const recordManualPayment = useCallback(async (payload) => {
    const { payment: created } = await api.post('/payments/record', payload)
    setPayments((prev) => [created, ...prev])
    return created
  }, [])

  const value = useMemo(
    () => ({
      customers, setCustomers, addCustomer, deleteCustomer,
      projects, setProjects, addProject, advanceProjectStage, revertProjectStage,
      designers, contractors, suppliers, materials, quotations, appointments, payments,
      revenueTrend, customerGrowth, isLoading,
      refreshAppointments, refreshPayments, refreshQuotations, refreshProjects,
      addSupplier, addMaterial, addQuotation,
      addAppointment, updateAppointmentStatus, rescheduleAppointment, getAppointmentAvailability,
      createPaymentOrder, verifyPayment, mockConfirmPayment, recordManualPayment,
      PROJECT_STAGES
    }),
    [
      customers, addCustomer, deleteCustomer,
      projects, addProject, advanceProjectStage, revertProjectStage,
      designers, contractors, suppliers, materials, quotations, appointments, payments,
      revenueTrend, customerGrowth, isLoading, refreshAppointments, refreshPayments, refreshQuotations, refreshProjects,
      addSupplier, addMaterial, addQuotation,
      addAppointment, updateAppointmentStatus, rescheduleAppointment, getAppointmentAvailability,
      createPaymentOrder, verifyPayment, mockConfirmPayment, recordManualPayment
    ]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
