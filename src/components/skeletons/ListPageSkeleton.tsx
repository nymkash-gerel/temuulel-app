export default function ListPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header: title + action button */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-xl p-5 space-y-3">
            <div className="h-4 w-24 bg-slate-700 rounded" />
            <div className="h-8 w-32 bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      {/* Search/filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 bg-slate-800 rounded-lg" />
        <div className="h-10 w-28 bg-slate-800 rounded-lg" />
      </div>

      {/* Table rows */}
      <div className="bg-slate-800 rounded-xl p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-700 rounded" />
              <div className="h-3 w-1/2 bg-slate-700 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-700 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
