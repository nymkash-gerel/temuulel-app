export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-xl p-5 space-y-3">
            <div className="h-4 w-24 bg-slate-700 rounded" />
            <div className="h-8 w-32 bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-slate-800 rounded-xl p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-700 rounded" />
              <div className="h-3 w-1/2 bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
