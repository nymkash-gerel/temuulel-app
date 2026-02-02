export default function ChatDetailLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-pulse">
      {/* Chat header */}
      <div className="border-b border-slate-700 p-4 flex items-center gap-3">
        <div className="h-10 w-10 bg-slate-700 rounded-full" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-slate-700 rounded" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
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

      {/* Input */}
      <div className="border-t border-slate-700 p-4">
        <div className="h-12 bg-slate-800 rounded-xl" />
      </div>
    </div>
  )
}
