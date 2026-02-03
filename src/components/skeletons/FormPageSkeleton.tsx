export default function FormPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 bg-slate-800 rounded" />
        <div className="h-7 w-40 bg-slate-800 rounded" />
      </div>

      {/* Form card */}
      <div className="bg-slate-800 rounded-xl p-6 space-y-5 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-700 rounded-lg" />
          </div>
        ))}
        {/* Two-column row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-700 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-700 rounded-lg" />
          </div>
        </div>
        {/* Textarea */}
        <div className="space-y-2">
          <div className="h-4 w-16 bg-slate-700 rounded" />
          <div className="h-24 w-full bg-slate-700 rounded-lg" />
        </div>
        {/* Submit button */}
        <div className="h-10 w-32 bg-slate-700 rounded-lg" />
      </div>
    </div>
  )
}
