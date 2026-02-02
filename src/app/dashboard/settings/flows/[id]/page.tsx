'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import FlowCanvas to avoid SSR issues with React Flow
const FlowCanvas = dynamic(
  () => import('@/components/flow-editor/FlowCanvas'),
  { ssr: false, loading: () => <LoadingState /> }
)

function LoadingState() {
  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )
}

export default function FlowEditorPage() {
  const params = useParams()
  const router = useRouter()
  const flowId = params.id as string
  const [flowData, setFlowData] = useState<{
    name: string
    description?: string
    status: string
    trigger_type: string
    trigger_config: Record<string, unknown>
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; label?: string }>
    viewport?: { x: number; y: number; zoom: number }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/flows/${flowId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Flow not found')
        return r.json()
      })
      .then((data) => setFlowData(data.flow))
      .catch((err) => setError(err.message))
  }, [flowId])

  if (error) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/settings/flows')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg"
          >
            Буцах
          </button>
        </div>
      </div>
    )
  }

  if (!flowData) {
    return <LoadingState />
  }

  return <FlowCanvas flowId={flowId} initialData={flowData} />
}
