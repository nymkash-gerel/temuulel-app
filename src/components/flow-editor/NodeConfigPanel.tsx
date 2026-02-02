'use client'

import type { Node } from '@xyflow/react'

interface NodeConfigPanelProps {
  node: Node | null
  onUpdate: (nodeId: string, config: Record<string, unknown>, label?: string) => void
  onClose: () => void
  onDelete: (nodeId: string) => void
}

export default function NodeConfigPanel({ node, onUpdate, onClose, onDelete }: NodeConfigPanelProps) {
  if (!node) return null

  const config = (node.data?.config ?? {}) as Record<string, unknown>
  const nodeType = node.type ?? ''

  const update = (key: string, value: unknown) => {
    onUpdate(node.id, { ...config, [key]: value })
  }

  const updateLabel = (label: string) => {
    onUpdate(node.id, config, label)
  }

  return (
    <div className="w-72 bg-slate-800/80 border-l border-slate-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Нод тохиргоо</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Label */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Нэр</label>
        <input
          type="text"
          value={(node.data?.label as string) ?? ''}
          onChange={(e) => updateLabel(e.target.value)}
          className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Type-specific config */}
      {nodeType === 'send_message' && (
        <SendMessageConfig config={config} update={update} />
      )}
      {nodeType === 'ask_question' && (
        <AskQuestionConfig config={config} update={update} />
      )}
      {nodeType === 'button_choice' && (
        <ButtonChoiceConfig config={config} update={update} />
      )}
      {nodeType === 'condition' && (
        <ConditionConfigPanel config={config} update={update} onUpdate={onUpdate} nodeId={node.id} />
      )}
      {nodeType === 'api_action' && (
        <ApiActionConfig config={config} update={update} />
      )}
      {nodeType === 'show_items' && (
        <ShowItemsConfig config={config} update={update} />
      )}
      {nodeType === 'handoff' && (
        <HandoffConfig config={config} update={update} />
      )}
      {nodeType === 'delay' && (
        <DelayConfigPanel config={config} update={update} />
      )}
      {nodeType === 'end' && (
        <EndConfig config={config} update={update} />
      )}

      {/* Delete button */}
      {nodeType !== 'trigger' && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={() => onDelete(node.id)}
            className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
          >
            Нод устгах
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Config sub-forms
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-slate-400 mb-1">{children}</label>
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
    />
  )
}

function Input({ value, onChange, type = 'text', placeholder }: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

function SendMessageConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Мессеж</FieldLabel>
        <TextArea value={(config.text as string) ?? ''} onChange={(v) => update('text', v)} />
        <p className="text-[10px] text-slate-500 mt-0.5">{'{{variable}}'} ашиглах боломжтой</p>
      </div>
    </div>
  )
}

function AskQuestionConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Асуулт</FieldLabel>
        <TextArea value={(config.question_text as string) ?? ''} onChange={(v) => update('question_text', v)} />
      </div>
      <div>
        <FieldLabel>Хувьсагчийн нэр</FieldLabel>
        <Input value={(config.variable_name as string) ?? ''} onChange={(v) => update('variable_name', v)} placeholder="phone" />
      </div>
      <div>
        <FieldLabel>Баталгаажуулалт</FieldLabel>
        <Select
          value={(config.validation as string) ?? 'text'}
          onChange={(v) => update('validation', v)}
          options={[
            { value: 'text', label: 'Текст' },
            { value: 'phone', label: 'Утасны дугаар' },
            { value: 'email', label: 'Имэйл' },
            { value: 'number', label: 'Тоо' },
            { value: 'date', label: 'Огноо' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Алдааны мессеж (заавал биш)</FieldLabel>
        <Input value={(config.error_message as string) ?? ''} onChange={(v) => update('error_message', v)} placeholder="Зөв утасны дугаар оруулна уу" />
      </div>
    </div>
  )
}

function ButtonChoiceConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  const buttons = (config.buttons as { label: string; value: string }[]) ?? []

  const updateButton = (index: number, field: 'label' | 'value', val: string) => {
    const next = buttons.map((b, i) => (i === index ? { ...b, [field]: val } : b))
    update('buttons', next)
  }

  const addButton = () => {
    const n = buttons.length + 1
    update('buttons', [...buttons, { label: `Сонголт ${n}`, value: `option_${n}` }])
  }

  const removeButton = (index: number) => {
    update('buttons', buttons.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Асуулт</FieldLabel>
        <TextArea value={(config.question_text as string) ?? ''} onChange={(v) => update('question_text', v)} rows={2} />
      </div>
      <div>
        <FieldLabel>Хувьсагчийн нэр</FieldLabel>
        <Input value={(config.variable_name as string) ?? ''} onChange={(v) => update('variable_name', v)} />
      </div>
      <div>
        <FieldLabel>Товчнууд</FieldLabel>
        <div className="space-y-2">
          {buttons.map((btn, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input
                value={btn.label}
                onChange={(e) => updateButton(i, 'label', e.target.value)}
                placeholder="Нэр"
                className="flex-1 px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-white focus:outline-none"
              />
              <input
                value={btn.value}
                onChange={(e) => updateButton(i, 'value', e.target.value)}
                placeholder="Утга"
                className="w-20 px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-white focus:outline-none"
              />
              <button
                onClick={() => removeButton(i)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addButton}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            + Товч нэмэх
          </button>
        </div>
      </div>
    </div>
  )
}

function ConditionConfigPanel({ config, onUpdate, nodeId }: {
  config: Record<string, unknown>
  update: (k: string, v: unknown) => void
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void
  nodeId: string
}) {
  const conditions = (config.conditions as { variable: string; operator: string; value: string; next_node_id: string }[]) ?? []

  const updateCondition = (index: number, field: string, val: string) => {
    const next = conditions.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    onUpdate(nodeId, { ...config, conditions: next })
  }

  const addCondition = () => {
    onUpdate(nodeId, {
      ...config,
      conditions: [...conditions, { variable: '', operator: 'equals', value: '', next_node_id: '' }],
    })
  }

  const removeCondition = (index: number) => {
    onUpdate(nodeId, { ...config, conditions: conditions.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Нөхцөлүүд</FieldLabel>
      {conditions.map((cond, i) => (
        <div key={i} className="p-2 bg-slate-700/30 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-yellow-400">#{i + 1}</span>
            <button onClick={() => removeCondition(i)} className="text-red-400 text-xs">×</button>
          </div>
          <input
            value={cond.variable}
            onChange={(e) => updateCondition(i, 'variable', e.target.value)}
            placeholder="Хувьсагч нэр"
            className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-white focus:outline-none"
          />
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, 'operator', e.target.value)}
            className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-white focus:outline-none"
          >
            <option value="equals">Тэнцүү</option>
            <option value="contains">Агуулсан</option>
            <option value="greater_than">Их</option>
            <option value="less_than">Бага</option>
            <option value="exists">Байгаа</option>
          </select>
          {cond.operator !== 'exists' && (
            <input
              value={cond.value}
              onChange={(e) => updateCondition(i, 'value', e.target.value)}
              placeholder="Утга"
              className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-white focus:outline-none"
            />
          )}
        </div>
      ))}
      <button onClick={addCondition} className="text-xs text-blue-400 hover:text-blue-300">
        + Нөхцөл нэмэх
      </button>
    </div>
  )
}

function ApiActionConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Үйлдлийн төрөл</FieldLabel>
        <Select
          value={(config.action_type as string) ?? 'create_order'}
          onChange={(v) => update('action_type', v)}
          options={[
            { value: 'create_order', label: 'Захиалга үүсгэх' },
            { value: 'create_appointment', label: 'Цаг захиалга' },
            { value: 'search_products', label: 'Бүтээгдэхүүн хайх' },
            { value: 'search_services', label: 'Үйлчилгээ хайх' },
            { value: 'webhook', label: 'Webhook' },
          ]}
        />
      </div>
      {config.action_type === 'webhook' && (
        <div>
          <FieldLabel>Webhook URL</FieldLabel>
          <Input
            value={((config.action_config as Record<string, string>)?.url) ?? ''}
            onChange={(v) => update('action_config', { ...((config.action_config as object) ?? {}), url: v })}
            placeholder="https://..."
          />
        </div>
      )}
    </div>
  )
}

function ShowItemsConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Эх сурвалж</FieldLabel>
        <Select
          value={(config.source as string) ?? 'products'}
          onChange={(v) => update('source', v)}
          options={[
            { value: 'products', label: 'Бүтээгдэхүүн' },
            { value: 'services', label: 'Үйлчилгээ' },
            { value: 'variable', label: 'Хувьсагч' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Харуулах хэлбэр</FieldLabel>
        <Select
          value={(config.display_format as string) ?? 'list'}
          onChange={(v) => update('display_format', v)}
          options={[
            { value: 'list', label: 'Жагсаалт' },
            { value: 'cards', label: 'Карт' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Ангилал шүүлт (заавал биш)</FieldLabel>
        <Input value={(config.filter_category as string) ?? ''} onChange={(v) => update('filter_category', v)} placeholder="Ундаа" />
      </div>
      <div>
        <FieldLabel>Хамгийн их тоо</FieldLabel>
        <Input type="number" value={(config.max_items as number) ?? 8} onChange={(v) => update('max_items', parseInt(v) || 8)} />
      </div>
      <div>
        <FieldLabel>Сонголтын хувьсагч (заавал биш)</FieldLabel>
        <Input value={(config.selection_variable as string) ?? ''} onChange={(v) => update('selection_variable', v)} placeholder="selected_item" />
      </div>
    </div>
  )
}

function HandoffConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Мессеж</FieldLabel>
        <TextArea value={(config.message as string) ?? ''} onChange={(v) => update('message', v)} />
      </div>
    </div>
  )
}

function DelayConfigPanel({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Хүлээх хугацаа (секунд)</FieldLabel>
        <Input type="number" value={(config.seconds as number) ?? 2} onChange={(v) => update('seconds', parseInt(v) || 2)} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={(config.typing_indicator as boolean) ?? true}
          onChange={(e) => update('typing_indicator', e.target.checked)}
          className="rounded bg-slate-700 border-slate-600"
        />
        <span className="text-xs text-slate-300">Бичиж байна... харуулах</span>
      </div>
    </div>
  )
}

function EndConfig({ config, update }: { config: Record<string, unknown>; update: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Хаах мессеж (заавал биш)</FieldLabel>
        <TextArea value={(config.message as string) ?? ''} onChange={(v) => update('message', v)} />
      </div>
    </div>
  )
}
