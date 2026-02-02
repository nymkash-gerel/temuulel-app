'use client'

import { NODE_STYLES } from './CustomNodes'

const PALETTE_ITEMS = [
  'send_message',
  'ask_question',
  'button_choice',
  'condition',
  'api_action',
  'show_items',
  'handoff',
  'delay',
  'end',
] as const

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-48 bg-slate-800/50 border-r border-slate-700 p-3 space-y-1.5 overflow-y-auto">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Нод нэмэх
      </p>
      {PALETTE_ITEMS.map((type) => {
        const style = NODE_STYLES[type]
        if (!style) return null
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/50 rounded-lg cursor-grab active:cursor-grabbing transition-colors"
          >
            <span className="text-sm">{style.icon}</span>
            <span className="text-sm text-slate-300">{style.label}</span>
          </div>
        )
      })}
    </div>
  )
}
