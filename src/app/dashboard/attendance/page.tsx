'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AttendanceRecord {
  id: string
  session_id: string
  student_id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes: string | null
  created_at: string
  students: { id: string; first_name: string; last_name: string } | null
  course_sessions: { id: string; title: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  present: { label: 'Ирсэн', color: 'bg-green-500/20 text-green-400' },
  absent: { label: 'Тасалсан', color: 'bg-red-500/20 text-red-400' },
  late: { label: 'Хоцорсон', color: 'bg-yellow-500/20 text-yellow-400' },
  excused: { label: 'Чөлөөтэй', color: 'bg-blue-500/20 text-blue-400' },
}

export default function AttendancePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function load() {
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

      if (store) {
        const { data } = await supabase
          .from('attendance')
          .select(`
            id, session_id, student_id, status, notes, created_at,
            students(id, first_name, last_name),
            course_sessions(id, title)
          `)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        if (data) {
          setRecords(data as unknown as AttendanceRecord[])
        }
      }

      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    if (!statusFilter) return records
    return records.filter((r) => r.status === statusFilter)
  }, [records, statusFilter])

  const stats = useMemo(() => ({
    present: records.filter((r) => r.status === 'present').length,
    absent: records.filter((r) => r.status === 'absent').length,
    late: records.filter((r) => r.status === 'late').length,
    excused: records.filter((r) => r.status === 'excused').length,
  }), [records])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Ирц</h1>
          <p className="text-slate-400 mt-1">
            Нийт {records.length} бүртгэл
            {filtered.length !== records.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Ирсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.present}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Тасалсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.absent}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хоцорсон</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.late}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Чөлөөтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.excused}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="present">Ирсэн</option>
              <option value="absent">Тасалсан</option>
              <option value="late">Хоцорсон</option>
              <option value="excused">Чөлөөтэй</option>
            </select>
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Attendance Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хичээл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Суралцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Тэмдэглэл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => {
                const sc = STATUS_CONFIG[record.status] || STATUS_CONFIG.present
                return (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {record.course_sessions?.title || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">
                        {record.students
                          ? `${record.students.first_name} ${record.students.last_name}`
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {record.notes || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(record.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : records.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Шүүлтүүрт тохирох бүртгэл олдсонгүй</p>
          <button
            onClick={() => setStatusFilter('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Ирцийн бүртгэл байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Хичээлийн ирцийн бүртгэл хийгдэхэд энд харагдана
          </p>
        </div>
      )}
    </div>
  )
}
