'use client'

import { useState, useMemo } from 'react'

export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date string or YYYY-MM-DD
  time?: string // e.g. "09:00"
  endTime?: string
  status?: string
  statusColor?: string // tailwind color class
  href?: string
  meta?: string // secondary text (e.g. customer name)
}

interface CalendarViewProps {
  events: CalendarEvent[]
  onDateClick?: (date: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

const MN_MONTHS = [
  'Нэгдүгээр сар', 'Хоёрдугаар сар', 'Гуравдугаар сар',
  'Дөрөвдүгээр сар', 'Тавдугаар сар', 'Зургадугаар сар',
  'Долдугаар сар', 'Наймдугаар сар', 'Есдүгээр сар',
  'Аравдугаар сар', 'Арван нэгдүгээр сар', 'Арван хоёрдугаар сар',
]

const MN_WEEKDAYS = ['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: (number | null)[] = []

  // Fill leading blanks
  for (let i = 0; i < startDow; i++) {
    days.push(null)
  }

  // Fill actual days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  return days
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarView({ events, onDateClick, onEventClick }: CalendarViewProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      const dateStr = event.date.slice(0, 10)
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(event)
    }
    return map
  }, [events])

  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </button>
          <h2 className="text-lg font-semibold text-white min-w-[220px] text-center">
            {viewYear} {MN_MONTHS[viewMonth]}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &rarr;
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
        >
          Өнөөдөр
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-700">
        {MN_WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium text-slate-400">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="min-h-[80px] border-b border-r border-slate-700/50" />
          }

          const dateKey = formatDateKey(viewYear, viewMonth, day)
          const dayEvents = eventsByDate[dateKey] || []
          const isToday = dateKey === todayKey

          return (
            <div
              key={dateKey}
              className={`min-h-[80px] border-b border-r border-slate-700/50 p-1 cursor-pointer hover:bg-slate-700/30 transition-colors ${
                isToday ? 'bg-blue-500/10' : ''
              }`}
              onClick={() => onDateClick?.(dateKey)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    isToday
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400'
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-slate-500">{dayEvents.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={`text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${
                      event.statusColor || 'bg-blue-500/20 text-blue-400'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick?.(event)
                    }}
                    title={`${event.time ? event.time + ' ' : ''}${event.title}${event.meta ? ' - ' + event.meta : ''}`}
                  >
                    {event.time && <span className="font-medium">{event.time} </span>}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-slate-500 px-1.5">
                    +{dayEvents.length - 3} бусад
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
