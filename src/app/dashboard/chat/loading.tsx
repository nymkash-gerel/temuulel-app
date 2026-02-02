export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] animate-pulse">
      {/* Conversation list skeleton */}
      <div className="w-80 border-r border-slate-700 p-4 space-y-3">
        <div className="h-10 bg-slate-800 rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="h-10 w-10 bg-slate-700 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-slate-700 rounded" />
              <div className="h-3 w-40 bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`h-12 rounded-xl bg-slate-800 ${
                  i % 2 === 0 ? 'w-64' : 'w-48'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="h-12 bg-slate-800 rounded-xl mt-4" />
      </div>
    </div>
  )
}
