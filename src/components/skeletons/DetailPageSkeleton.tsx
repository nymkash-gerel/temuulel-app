export default function DetailPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 bg-slate-800 rounded" />
        <div className="h-7 w-48 bg-slate-800 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 space-y-4">
            <div className="h-5 w-32 bg-slate-700 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-14 w-14 bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-700 rounded" />
                  <div className="h-3 w-24 bg-slate-700 rounded" />
                </div>
                <div className="h-5 w-20 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-slate-800 rounded-xl p-6 space-y-4">
            <div className="h-5 w-40 bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
          </div>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 space-y-3">
            <div className="h-5 w-24 bg-slate-700 rounded" />
            <div className="h-8 w-full bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-slate-700 rounded" />
          </div>
          <div className="bg-slate-800 rounded-xl p-6 space-y-3">
            <div className="h-5 w-28 bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-700 rounded" />
            <div className="h-4 w-2/3 bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
