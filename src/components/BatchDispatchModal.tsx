'use client'

import type { BatchPreview } from '@/app/api/deliveries/batch-assign/route'

interface Props {
  preview: BatchPreview
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
}

export default function BatchDispatchModal({ preview, onConfirm, onCancel, confirming }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">🤖 Ухаалаг хуваарилалт</h2>
          <p className="text-slate-400 text-sm mt-1">
            {preview.total} хүргэлт · {preview.by_driver.length} жолооч
            {preview.unassigned.length > 0 && (
              <span className="text-orange-400"> · {preview.unassigned.length} оноох боломжгүй</span>
            )}
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Per-driver cards */}
          {preview.by_driver.map((d) => (
            <div key={d.driver_id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-bold text-blue-400">
                    {d.driver_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{d.driver_name}</p>
                    <p className="text-slate-500 text-xs">
                      {d.zones.length > 0 ? d.zones.join(', ') : 'Бүх бүс'} •{' '}
                      Өнөөдөр нийт: {d.today_existing + d.new_count}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">{d.new_count}</span>
                  <p className="text-slate-500 text-xs">
                    +{d.new_count} (одоо {d.today_existing})
                  </p>
                </div>
              </div>

              {/* Delivery list */}
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {d.deliveries.map((del, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-slate-700/40 last:border-0">
                    <span className={`shrink-0 mt-0.5 ${del.zone_match ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {del.zone_match ? '✅' : '⚠️'}
                    </span>
                    <div className="min-w-0">
                      <span className="text-slate-300 font-medium">#{del.delivery_number}</span>
                      <span className="text-slate-500 ml-2 truncate">{del.address}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned */}
          {preview.unassigned.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium mb-2">
                ❌ Оноох боломжгүй ({preview.unassigned.length})
              </p>
              <div className="space-y-1">
                {preview.unassigned.map((u, i) => (
                  <p key={i} className="text-xs text-red-300/70">
                    #{u.delivery_number} — {u.reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="text-emerald-400">✅</span> Бүсэд тохирсон</span>
            <span className="flex items-center gap-1"><span className="text-yellow-400">⚠️</span> Бүс тохироогүй (ойролцоо)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all disabled:opacity-50 text-sm"
          >
            Цуцлах
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming || preview.total === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 text-sm flex items-center gap-2"
          >
            {confirming ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Оноож байна...
              </>
            ) : (
              `✅ ${preview.total} хүргэлт оноох`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
