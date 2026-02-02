'use client'

interface FlowToolbarProps {
  flowName: string
  onNameChange: (name: string) => void
  onSave: () => void
  onBack: () => void
  saving: boolean
  hasChanges: boolean
  status: string
  onToggleStatus: () => void
}

export default function FlowToolbar({
  flowName,
  onNameChange,
  onSave,
  onBack,
  saving,
  hasChanges,
  status,
  onToggleStatus,
}: FlowToolbarProps) {
  return (
    <div className="h-14 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          ← Буцах
        </button>
        <div className="w-px h-6 bg-slate-700" />
        <input
          type="text"
          value={flowName}
          onChange={(e) => onNameChange(e.target.value)}
          className="bg-transparent text-white font-medium text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 w-64"
          placeholder="Урсгалын нэр"
        />
        {hasChanges && (
          <span className="text-xs text-yellow-400/70">Хадгалаагүй</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleStatus}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            status === 'active'
              ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30'
              : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {status === 'active' ? 'Идэвхтэй' : 'Ноорог'}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-400 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
      </div>
    </div>
  )
}
