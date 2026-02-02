export default function ProductDetailLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 bg-slate-800 rounded" />
        <div className="h-7 w-40 bg-slate-800 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image area */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-xl aspect-square" />
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 space-y-4">
            <div className="h-6 w-64 bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
            <div className="h-8 w-32 bg-slate-700 rounded mt-4" />
          </div>
          <div className="bg-slate-800 rounded-xl p-6 space-y-3">
            <div className="h-5 w-24 bg-slate-700 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-slate-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
