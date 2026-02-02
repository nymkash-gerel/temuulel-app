'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface BaseNodeProps {
  id: string
  data: { label: string; config: Record<string, unknown> }
  selected?: boolean
}

const NODE_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  trigger:      { color: 'green',  icon: '▶',  label: 'Эхлэл' },
  send_message: { color: 'blue',   icon: '💬', label: 'Мессеж' },
  ask_question: { color: 'orange', icon: '❓', label: 'Асуулт' },
  button_choice:{ color: 'purple', icon: '🔘', label: 'Товч' },
  condition:    { color: 'yellow', icon: '🔀', label: 'Нөхцөл' },
  api_action:   { color: 'red',    icon: '⚡', label: 'Үйлдэл' },
  show_items:   { color: 'cyan',   icon: '📋', label: 'Жагсаалт' },
  handoff:      { color: 'rose',   icon: '🤝', label: 'Шилжих' },
  delay:        { color: 'slate',  icon: '⏳', label: 'Хүлээх' },
  end:          { color: 'gray',   icon: '🏁', label: 'Төгсгөл' },
}

const colorMap: Record<string, string> = {
  green:  'border-green-500/50 bg-green-500/10',
  blue:   'border-blue-500/50 bg-blue-500/10',
  orange: 'border-orange-500/50 bg-orange-500/10',
  purple: 'border-purple-500/50 bg-purple-500/10',
  yellow: 'border-yellow-500/50 bg-yellow-500/10',
  red:    'border-red-500/50 bg-red-500/10',
  cyan:   'border-cyan-500/50 bg-cyan-500/10',
  rose:   'border-rose-500/50 bg-rose-500/10',
  slate:  'border-slate-500/50 bg-slate-500/10',
  gray:   'border-slate-600/50 bg-slate-600/10',
}

const headerColorMap: Record<string, string> = {
  green:  'bg-green-500/30 text-green-300',
  blue:   'bg-blue-500/30 text-blue-300',
  orange: 'bg-orange-500/30 text-orange-300',
  purple: 'bg-purple-500/30 text-purple-300',
  yellow: 'bg-yellow-500/30 text-yellow-300',
  red:    'bg-red-500/30 text-red-300',
  cyan:   'bg-cyan-500/30 text-cyan-300',
  rose:   'bg-rose-500/30 text-rose-300',
  slate:  'bg-slate-500/30 text-slate-300',
  gray:   'bg-slate-600/30 text-slate-400',
}

function NodeShell({
  type,
  data,
  selected,
  children,
  hasTarget = true,
  hasSource = true,
  sourceHandles,
}: {
  type: string
  data: { label: string }
  selected?: boolean
  children?: React.ReactNode
  hasTarget?: boolean
  hasSource?: boolean
  sourceHandles?: { id: string; label: string }[]
}) {
  const style = NODE_STYLES[type] ?? NODE_STYLES.end
  const borderClass = colorMap[style.color] ?? colorMap.gray
  const headerClass = headerColorMap[style.color] ?? headerColorMap.gray

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-xl border ${borderClass} ${
        selected ? 'ring-2 ring-blue-400/60' : ''
      } shadow-lg`}
    >
      {hasTarget && (
        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-600" />
      )}
      <div className={`px-3 py-1.5 rounded-t-xl text-xs font-medium ${headerClass}`}>
        {style.icon} {style.label}
      </div>
      <div className="p-3 bg-slate-800/80 rounded-b-xl">
        <p className="text-sm text-slate-200 font-medium truncate">{data.label}</p>
        {children}
      </div>
      {sourceHandles ? (
        sourceHandles.map((h, i) => (
          <Handle
            key={h.id}
            type="source"
            position={Position.Bottom}
            id={h.id}
            className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-600"
            style={{ left: `${((i + 1) / (sourceHandles.length + 1)) * 100}%` }}
          />
        ))
      ) : hasSource ? (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-600" />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node Components
// ---------------------------------------------------------------------------

export const TriggerNode = memo(function TriggerNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { keywords?: string[] }
  return (
    <NodeShell type="trigger" data={data} selected={selected} hasTarget={false}>
      {config.keywords && config.keywords.length > 0 && (
        <p className="text-xs text-slate-400 mt-1 truncate">
          {config.keywords.join(', ')}
        </p>
      )}
    </NodeShell>
  )
})

export const SendMessageNode = memo(function SendMessageNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { text?: string }
  return (
    <NodeShell type="send_message" data={data} selected={selected}>
      {config.text && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{config.text}</p>
      )}
    </NodeShell>
  )
})

export const AskQuestionNode = memo(function AskQuestionNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { question_text?: string; variable_name?: string }
  return (
    <NodeShell type="ask_question" data={data} selected={selected}>
      {config.question_text && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{config.question_text}</p>
      )}
      {config.variable_name && (
        <p className="text-xs text-cyan-400/70 mt-0.5">→ {config.variable_name}</p>
      )}
    </NodeShell>
  )
})

export const ButtonChoiceNode = memo(function ButtonChoiceNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { buttons?: { label: string; value: string }[]; question_text?: string }
  const buttons = config.buttons ?? []

  const sourceHandles = buttons.map((btn, i) => ({
    id: `button_${i}`,
    label: btn.label,
  }))

  return (
    <NodeShell
      type="button_choice"
      data={data}
      selected={selected}
      sourceHandles={sourceHandles.length > 0 ? sourceHandles : undefined}
    >
      {config.question_text && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{config.question_text}</p>
      )}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {buttons.map((btn, i) => (
            <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded-md">
              {btn.label}
            </span>
          ))}
        </div>
      )}
    </NodeShell>
  )
})

export const ConditionNode = memo(function ConditionNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { conditions?: { variable: string; operator: string; value: string }[] }
  const conditions = config.conditions ?? []

  const sourceHandles = [
    ...conditions.map((_, i) => ({ id: `condition_${i}`, label: `#${i + 1}` })),
    { id: 'default', label: 'Default' },
  ]

  return (
    <NodeShell type="condition" data={data} selected={selected} sourceHandles={sourceHandles}>
      {conditions.length > 0 && (
        <p className="text-xs text-slate-400 mt-1">
          {conditions.length} нөхцөл
        </p>
      )}
    </NodeShell>
  )
})

export const ApiActionNode = memo(function ApiActionNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { action_type?: string }
  const actionLabels: Record<string, string> = {
    create_appointment: 'Цаг захиалга',
    create_order: 'Захиалга',
    search_products: 'Бүтээгдэхүүн хайх',
    search_services: 'Үйлчилгээ хайх',
    webhook: 'Webhook',
  }
  return (
    <NodeShell type="api_action" data={data} selected={selected}>
      {config.action_type && (
        <p className="text-xs text-red-400/70 mt-1">
          {actionLabels[config.action_type] ?? config.action_type}
        </p>
      )}
    </NodeShell>
  )
})

export const ShowItemsNode = memo(function ShowItemsNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { source?: string; max_items?: number }
  const sourceLabels: Record<string, string> = {
    products: 'Бүтээгдэхүүн',
    services: 'Үйлчилгээ',
    variable: 'Хувьсагч',
  }
  return (
    <NodeShell type="show_items" data={data} selected={selected}>
      {config.source && (
        <p className="text-xs text-cyan-400/70 mt-1">
          {sourceLabels[config.source] ?? config.source}
          {config.max_items ? ` (${config.max_items})` : ''}
        </p>
      )}
    </NodeShell>
  )
})

export const HandoffNode = memo(function HandoffNode({ data, selected }: BaseNodeProps) {
  return (
    <NodeShell type="handoff" data={data} selected={selected} hasSource={false}>
      <p className="text-xs text-rose-400/70 mt-1">Оператор руу шилжүүлэх</p>
    </NodeShell>
  )
})

export const DelayNode = memo(function DelayNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { seconds?: number }
  return (
    <NodeShell type="delay" data={data} selected={selected}>
      {config.seconds && (
        <p className="text-xs text-slate-400 mt-1">{config.seconds} секунд</p>
      )}
    </NodeShell>
  )
})

export const EndNode = memo(function EndNode({ data, selected }: BaseNodeProps) {
  const config = data.config as { message?: string }
  return (
    <NodeShell type="end" data={data} selected={selected} hasSource={false}>
      {config.message && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{config.message}</p>
      )}
    </NodeShell>
  )
})

// ---------------------------------------------------------------------------
// Node type registry for React Flow
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, React.ComponentType<any>> = {
  trigger: TriggerNode,
  send_message: SendMessageNode,
  ask_question: AskQuestionNode,
  button_choice: ButtonChoiceNode,
  condition: ConditionNode,
  api_action: ApiActionNode,
  show_items: ShowItemsNode,
  handoff: HandoffNode,
  delay: DelayNode,
  end: EndNode,
}

// Default config for each node type (used when creating new nodes)
export function getDefaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'trigger':
      return { type: 'trigger' }
    case 'send_message':
      return { type: 'send_message', text: '' }
    case 'ask_question':
      return { type: 'ask_question', question_text: '', variable_name: 'answer', validation: 'text' }
    case 'button_choice':
      return {
        type: 'button_choice',
        question_text: '',
        variable_name: 'choice',
        buttons: [
          { label: 'Сонголт 1', value: 'option_1' },
          { label: 'Сонголт 2', value: 'option_2' },
        ],
      }
    case 'condition':
      return {
        type: 'condition',
        conditions: [{ variable: '', operator: 'equals', value: '', next_node_id: '' }],
        default_node_id: '',
      }
    case 'api_action':
      return { type: 'api_action', action_type: 'create_order', action_config: {} }
    case 'show_items':
      return { type: 'show_items', source: 'products', display_format: 'list', max_items: 8 }
    case 'handoff':
      return { type: 'handoff', message: 'Та түр хүлээнэ үү, оператор тантай холбогдоно.' }
    case 'delay':
      return { type: 'delay', seconds: 2, typing_indicator: true }
    case 'end':
      return { type: 'end', message: '' }
    default:
      return {}
  }
}

export function getDefaultLabel(type: string): string {
  return NODE_STYLES[type]?.label ?? type
}

export { NODE_STYLES }
