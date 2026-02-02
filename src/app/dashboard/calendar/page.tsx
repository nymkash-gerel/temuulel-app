'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Appointment {
  id: string
  store_id: string
  customer_id: string | null
  staff_id: string | null
  service_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  total_amount: number
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  resource_id: string | null
  services?: { name: string } | null
  staff?: { name: string } | null
  customers?: { name: string | null; phone: string | null } | null
  bookable_resources?: { name: string } | null
}

interface Staff {
  id: string
  name: string
  avatar_url: string | null
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  base_price: number
}

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const supabase = createClient()
  const [storeId, setStoreId] = useState<string>('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedStaff, setSelectedStaff] = useState<string>('all')

  // New appointment modal
  const [showModal, setShowModal] = useState(false)
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [newAppointment, setNewAppointment] = useState({
    service_id: '',
    staff_id: '',
    customer_name: '',
    customer_phone: '',
    notes: '',
    scheduled_time: '09:00'
  })
  const [savingAppointment, setSavingAppointment] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (storeId) {
      loadAppointments()
    }
  }, [storeId, currentDate, viewMode])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) return
    setStoreId(store.id)

    // Load staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, name, avatar_url')
      .eq('store_id', store.id)
      .eq('status', 'active')

    if (staffData) setStaff(staffData)

    // Load services
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, duration_minutes, base_price')
      .eq('store_id', store.id)
      .eq('status', 'active')

    if (servicesData) setServices(servicesData)

    setLoading(false)
  }

  const loadAppointments = async () => {
    const startDate = getStartOfPeriod(currentDate, viewMode)
    const endDate = getEndOfPeriod(currentDate, viewMode)

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        services(name),
        staff(name),
        customers(name, phone),
        bookable_resources(name)
      `)
      .eq('store_id', storeId)
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString())
      .order('scheduled_at', { ascending: true })

    if (!error && data) {
      setAppointments(data)
    }
  }

  const getStartOfPeriod = (date: Date, mode: ViewMode): Date => {
    const d = new Date(date)
    if (mode === 'day') {
      d.setHours(0, 0, 0, 0)
    } else if (mode === 'week') {
      const day = d.getDay()
      d.setDate(d.getDate() - day)
      d.setHours(0, 0, 0, 0)
    } else {
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
    }
    return d
  }

  const getEndOfPeriod = (date: Date, mode: ViewMode): Date => {
    const d = new Date(date)
    if (mode === 'day') {
      d.setHours(23, 59, 59, 999)
    } else if (mode === 'week') {
      const day = d.getDay()
      d.setDate(d.getDate() + (6 - day))
      d.setHours(23, 59, 59, 999)
    } else {
      d.setMonth(d.getMonth() + 1, 0)
      d.setHours(23, 59, 59, 999)
    }
    return d
  }

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const getWeekDays = useMemo(() => {
    const start = getStartOfPeriod(currentDate, 'week')
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [currentDate])

  const getHours = () => {
    const hours: string[] = []
    for (let i = 9; i <= 21; i++) {
      hours.push(`${i.toString().padStart(2, '0')}:00`)
    }
    return hours
  }

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.scheduled_at)
      return aptDate.toDateString() === date.toDateString() &&
        (selectedStaff === 'all' || apt.staff_id === selectedStaff)
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'in_progress': return 'bg-blue-500'
      case 'completed': return 'bg-slate-500'
      case 'cancelled': return 'bg-red-500'
      case 'no_show': return 'bg-orange-500'
      default: return 'bg-pink-500'
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateHeader = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' })
    } else if (viewMode === 'week') {
      const start = getStartOfPeriod(currentDate, 'week')
      const end = getEndOfPeriod(currentDate, 'week')
      return `${start.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long' })
    }
  }

  const openNewAppointmentModal = (date: Date) => {
    setModalDate(date)
    setNewAppointment({
      service_id: services[0]?.id || '',
      staff_id: staff[0]?.id || '',
      customer_name: '',
      customer_phone: '',
      notes: '',
      scheduled_time: '09:00'
    })
    setShowModal(true)
  }

  const handleCreateAppointment = async () => {
    if (!modalDate || !newAppointment.service_id || !newAppointment.customer_name) return

    setSavingAppointment(true)
    try {
      const service = services.find(s => s.id === newAppointment.service_id)
      const scheduledAt = new Date(modalDate)
      const [hours, minutes] = newAppointment.scheduled_time.split(':')
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0)

      const { error } = await supabase.from('appointments').insert({
        store_id: storeId,
        service_id: newAppointment.service_id,
        staff_id: newAppointment.staff_id || null,
        customer_name: newAppointment.customer_name,
        customer_phone: newAppointment.customer_phone || null,
        notes: newAppointment.notes || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: service?.duration_minutes || 60,
        total_amount: service?.base_price || 0,
        status: 'pending'
      })

      if (error) throw error

      setShowModal(false)
      loadAppointments()
    } catch (err) {
      console.error('Error creating appointment:', err)
    } finally {
      setSavingAppointment(false)
    }
  }

  const updateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)

    if (!error) {
      loadAppointments()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Хуанли</h1>
          <p className="text-slate-400 mt-1">{formatDateHeader()}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Staff Filter */}
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="all">Бүх ажилтан</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* View Mode */}
          <div className="flex bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm transition-all ${
                  viewMode === mode
                    ? 'bg-pink-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'day' ? 'Өдөр' : mode === 'week' ? '7 хоног' : 'Сар'}
              </button>
            ))}
          </div>

          <button
            onClick={() => openNewAppointmentModal(new Date())}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            + Захиалга
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigatePeriod('prev')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          Өнөөдөр
        </button>

        <button
          onClick={() => navigatePeriod('next')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-8 border-b border-slate-700">
            <div className="p-3 text-center text-sm text-slate-400 border-r border-slate-700">
              Цаг
            </div>
            {getWeekDays.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  className={`p-3 text-center border-r border-slate-700 last:border-r-0 ${
                    isToday ? 'bg-pink-500/10' : ''
                  }`}
                >
                  <div className="text-xs text-slate-400">
                    {day.toLocaleDateString('mn-MN', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-medium ${isToday ? 'text-pink-400' : 'text-white'}`}>
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Time Slots */}
          <div className="max-h-[600px] overflow-y-auto">
            {getHours().map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-slate-700/50 min-h-[80px]">
                <div className="p-2 text-center text-xs text-slate-400 border-r border-slate-700">
                  {hour}
                </div>
                {getWeekDays.map((day, i) => {
                  const dayAppointments = getAppointmentsForDay(day).filter(apt => {
                    const aptHour = new Date(apt.scheduled_at).getHours()
                    return aptHour === parseInt(hour)
                  })

                  return (
                    <div
                      key={i}
                      onClick={() => openNewAppointmentModal(day)}
                      className="p-1 border-r border-slate-700/50 last:border-r-0 hover:bg-slate-700/20 cursor-pointer relative"
                    >
                      {dayAppointments.map(apt => (
                        <div
                          key={apt.id}
                          className={`${getStatusColor(apt.status)} rounded-lg p-2 mb-1 text-white text-xs cursor-pointer hover:opacity-90`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-medium">{formatTime(apt.scheduled_at)}</div>
                          <div className="truncate">{apt.customer_name || apt.customers?.name}</div>
                          <div className="truncate opacity-75">{apt.services?.name}</div>
                          {apt.bookable_resources?.name && (
                            <div className="truncate opacity-60">{apt.bookable_resources.name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {getHours().map(hour => {
              const hourAppointments = appointments.filter(apt => {
                const aptDate = new Date(apt.scheduled_at)
                return aptDate.toDateString() === currentDate.toDateString() &&
                  aptDate.getHours() === parseInt(hour) &&
                  (selectedStaff === 'all' || apt.staff_id === selectedStaff)
              })

              return (
                <div key={hour} className="flex border-b border-slate-700/50">
                  <div className="w-20 p-4 text-sm text-slate-400 border-r border-slate-700 flex-shrink-0">
                    {hour}
                  </div>
                  <div
                    className="flex-1 p-2 min-h-[80px] hover:bg-slate-700/20 cursor-pointer"
                    onClick={() => {
                      const newDate = new Date(currentDate)
                      newDate.setHours(parseInt(hour))
                      openNewAppointmentModal(newDate)
                    }}
                  >
                    <div className="flex flex-wrap gap-2">
                      {hourAppointments.map(apt => (
                        <div
                          key={apt.id}
                          className={`${getStatusColor(apt.status)} rounded-lg p-3 text-white flex-1 min-w-[200px]`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{formatTime(apt.scheduled_at)}</span>
                            <span className="text-xs opacity-75">{apt.duration_minutes} мин</span>
                          </div>
                          <div className="font-medium">{apt.customer_name || apt.customers?.name}</div>
                          <div className="text-sm opacity-90">{apt.services?.name}</div>
                          {apt.bookable_resources?.name && (
                            <div className="text-xs opacity-75 mt-1">{apt.bookable_resources.name}</div>
                          )}
                          {apt.staff?.name && (
                            <div className="text-xs opacity-75 mt-1">{apt.staff.name}</div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {apt.status === 'pending' && (
                              <button
                                onClick={() => updateAppointmentStatus(apt.id, 'confirmed')}
                                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs"
                              >
                                Баталгаажуулах
                              </button>
                            )}
                            {apt.status === 'confirmed' && (
                              <button
                                onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs"
                              >
                                Дууссан
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-700">
            {['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'].map((day, i) => (
              <div key={i} className="p-3 text-center text-sm text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {(() => {
              const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
              const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
              const startDay = start.getDay()
              const totalDays = end.getDate()
              const cells = []

              // Empty cells before month starts
              for (let i = 0; i < startDay; i++) {
                cells.push(<div key={`empty-${i}`} className="p-2 min-h-[100px] border-r border-b border-slate-700/50" />)
              }

              // Days of month
              for (let day = 1; day <= totalDays; day++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                const dayAppointments = getAppointmentsForDay(date)
                const isToday = date.toDateString() === new Date().toDateString()

                cells.push(
                  <div
                    key={day}
                    onClick={() => openNewAppointmentModal(date)}
                    className={`p-2 min-h-[100px] border-r border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer ${
                      isToday ? 'bg-pink-500/10' : ''
                    }`}
                  >
                    <div className={`text-sm mb-1 ${isToday ? 'text-pink-400 font-bold' : 'text-white'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map(apt => (
                        <div
                          key={apt.id}
                          className={`${getStatusColor(apt.status)} rounded px-1 py-0.5 text-white text-xs truncate`}
                        >
                          {formatTime(apt.scheduled_at)} {apt.customer_name || apt.customers?.name}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-slate-400">
                          +{dayAppointments.length - 3} бусад
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return cells
            })()}
          </div>
        </div>
      )}

      {/* New Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Шинэ захиалга</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Үйлчилгээ *
                </label>
                <select
                  value={newAppointment.service_id}
                  onChange={(e) => setNewAppointment({ ...newAppointment, service_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">Сонгоно уу</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {new Intl.NumberFormat('mn-MN').format(s.base_price)}₮
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ажилтан
                </label>
                <select
                  value={newAppointment.staff_id}
                  onChange={(e) => setNewAppointment({ ...newAppointment, staff_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">Сонгоогүй</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Цаг *
                </label>
                <input
                  type="time"
                  value={newAppointment.scheduled_time}
                  onChange={(e) => setNewAppointment({ ...newAppointment, scheduled_time: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Үйлчлүүлэгчийн нэр *
                </label>
                <input
                  type="text"
                  value={newAppointment.customer_name}
                  onChange={(e) => setNewAppointment({ ...newAppointment, customer_name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Нэр"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Утасны дугаар
                </label>
                <input
                  type="tel"
                  value={newAppointment.customer_phone}
                  onChange={(e) => setNewAppointment({ ...newAppointment, customer_phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="99112233"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Тэмдэглэл
                </label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Нэмэлт мэдээлэл..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Болих
              </button>
              <button
                onClick={handleCreateAppointment}
                disabled={savingAppointment || !newAppointment.service_id || !newAppointment.customer_name}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {savingAppointment ? 'Хадгалж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
