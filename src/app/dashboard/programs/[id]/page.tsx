'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Program {
  id: string
  name: string
  description: string | null
  program_type: string
  duration_weeks: number
  price: number
  max_students: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CourseSession {
  id: string
  program_id: string
  title: string
  session_date: string
  start_time: string
  end_time: string
  location: string | null
  instructor_id: string | null
  created_at: string
}

interface Enrollment {
  id: string
  program_id: string
  student_id: string
  status: string
  enrolled_at: string
  completed_at: string | null
  created_at: string
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  course: 'Курс',
  workshop: 'Семинар',
  bootcamp: 'Bootcamp',
  tutoring: 'Хувийн хичээл',
  certification: 'Гэрчилгээ',
}

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-blue-500/20 text-blue-400' },
  withdrawn: { label: 'Гарсан', color: 'bg-red-500/20 text-red-400' },
  suspended: { label: 'Түр зогссон', color: 'bg-yellow-500/20 text-yellow-400' },
}

type TabKey = 'sessions' | 'enrollments'

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`
  }
  return timeStr
}

export default function ProgramDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState<boolean>(true)
  const [program, setProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<CourseSession[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('sessions')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData(): Promise<void> {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) {
      setLoading(false)
      return
    }

    const { data: programData } = await supabase
      .from('programs')
      .select('id, name, description, program_type, duration_weeks, price, max_students, is_active, created_at, updated_at')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!programData) {
      setProgram(null)
      setLoading(false)
      return
    }

    setProgram(programData as unknown as Program)

    const [sessionsResult, enrollmentsResult] = await Promise.all([
      supabase
        .from('course_sessions')
        .select('id, program_id, title, session_date, start_time, end_time, location, instructor_id, created_at')
        .eq('program_id', id)
        .order('session_date', { ascending: true }),
      supabase
        .from('enrollments')
        .select('id, program_id, student_id, status, enrolled_at, completed_at, created_at')
        .eq('program_id', id)
        .order('enrolled_at', { ascending: false }),
    ])

    setSessions((sessionsResult.data as unknown as CourseSession[]) || [])
    setEnrollments((enrollmentsResult.data as unknown as Enrollment[]) || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-64 bg-slate-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Хөтөлбөр олдсонгүй.</p>
        <Link
          href="/dashboard/programs"
          className="mt-4 text-blue-400 hover:underline inline-block"
        >
          Буцах
        </Link>
      </div>
    )
  }

  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const enrollmentCount = activeEnrollments.length
  const capacityPercent = program.max_students > 0
    ? Math.min(Math.round((enrollmentCount / program.max_students) * 100), 100)
    : 0

  const capacityBarColor = capacityPercent >= 90
    ? 'bg-red-500'
    : capacityPercent >= 70
      ? 'bg-yellow-500'
      : 'bg-green-500'

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'sessions', label: 'Хичээлүүд', count: sessions.length },
    { key: 'enrollments', label: 'Элсэлт', count: enrollments.length },
  ]

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/programs"
          className="text-slate-400 hover:text-white transition-colors"
        >
          &larr; Буцах
        </Link>
        <h1 className="text-2xl font-bold text-white">
          Хөтөлбөрийн дэлгэрэнгүй
        </h1>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Program Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Хөтөлбөрийн мэдээлэл
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white font-medium">{program.name}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төрөл</span>
              <p>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  {PROGRAM_TYPE_LABELS[program.program_type] || program.program_type}
                </span>
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Хугацаа</span>
              <p className="text-white">{program.duration_weeks} долоо хоног</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төлөв</span>
              <p>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    program.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {program.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Capacity Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Багтаамж</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Элсэгчид</span>
              <span className="text-white font-medium">
                {enrollmentCount} / {program.max_students}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${capacityBarColor} rounded-full transition-all duration-300`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-400">{capacityPercent}%</span>
            </div>
            <div>
              <span className="text-sm text-slate-400">Үлдсэн суудал</span>
              <p className="text-white font-medium">
                {Math.max(0, program.max_students - enrollmentCount)}
              </p>
            </div>
          </div>
        </div>

        {/* Price Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Үнэ</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Хөтөлбөрийн үнэ</span>
              <p className="text-2xl font-bold text-white">
                {formatPrice(program.price)}
              </p>
            </div>
          </div>
        </div>

        {/* Description Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Тайлбар</h2>
          <p className="text-slate-300 whitespace-pre-wrap">
            {program.description || 'Тайлбар оруулаагүй байна.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 mb-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <>
          {sessions.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Гарчиг
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Огноо
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Цаг
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Байршил
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white font-medium">
                          {session.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {formatDate(session.session_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {session.location || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
              <p className="text-slate-400">Хичээл бүртгэгдээгүй байна.</p>
            </div>
          )}
        </>
      )}

      {/* Enrollments Tab */}
      {activeTab === 'enrollments' && (
        <>
          {enrollments.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Оюутны ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Төлөв
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                      Элссэн огноо
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => {
                    const statusCfg = ENROLLMENT_STATUS_CONFIG[enrollment.status] || {
                      label: enrollment.status,
                      color: 'bg-slate-500/20 text-slate-400',
                    }
                    return (
                      <tr
                        key={enrollment.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                      >
                        <td className="py-3 px-4">
                          <span className="text-white text-sm font-mono">
                            {enrollment.student_id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-300 text-sm">
                            {formatDate(enrollment.enrolled_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
              <p className="text-slate-400">Элсэлт бүртгэгдээгүй байна.</p>
            </div>
          )}
        </>
      )}

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(program.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(program.updated_at)}</span>
      </div>
    </div>
  )
}
