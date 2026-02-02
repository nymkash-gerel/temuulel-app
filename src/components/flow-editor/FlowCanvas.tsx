'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes, getDefaultConfig, getDefaultLabel } from './CustomNodes'
import NodePalette from './NodePalette'
import NodeConfigPanel from './NodeConfigPanel'
import FlowToolbar from './FlowToolbar'
import { useRouter } from 'next/navigation'

interface FlowCanvasProps {
  flowId: string
  initialData: {
    name: string
    description?: string
    status: string
    trigger_type: string
    trigger_config: Record<string, unknown>
    nodes: Node[]
    edges: Edge[]
    viewport?: { x: number; y: number; zoom: number }
  }
}

export default function FlowCanvas({ flowId, initialData }: FlowCanvasProps) {
  const router = useRouter()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [flowName, setFlowName] = useState(initialData.name)
  const [flowStatus, setFlowStatus] = useState(initialData.status)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track changes
  useEffect(() => {
    setHasChanges(true)
  }, [nodes, edges, flowName])

  // Connect edges
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, id: `e_${Date.now()}` }, eds))
    },
    [setEdges]
  )

  // Node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Drag-and-drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type || !rfInstance) return

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: getDefaultLabel(type),
          config: getDefaultConfig(type),
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [rfInstance, setNodes]
  )

  // Update node config from panel
  const onUpdateNode = useCallback(
    (nodeId: string, config: Record<string, unknown>, label?: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            data: {
              ...n.data,
              config,
              ...(label !== undefined ? { label } : {}),
            },
          }
        })
      )
      // Also update selectedNode
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev
        return {
          ...prev,
          data: {
            ...prev.data,
            config,
            ...(label !== undefined ? { label } : {}),
          },
        }
      })
    },
    [setNodes]
  )

  // Delete node
  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  // Save flow
  const onSave = useCallback(async () => {
    setSaving(true)
    try {
      const viewport = rfInstance?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowName,
          status: flowStatus,
          nodes,
          edges,
          viewport,
        }),
      })
      if (res.ok) {
        setHasChanges(false)
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [flowId, flowName, flowStatus, nodes, edges, rfInstance])

  // Toggle status
  const onToggleStatus = useCallback(() => {
    setFlowStatus((s) => (s === 'active' ? 'draft' : 'active'))
  }, [])

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <FlowToolbar
        flowName={flowName}
        onNameChange={setFlowName}
        onSave={onSave}
        onBack={() => router.push('/dashboard/settings/flows')}
        saving={saving}
        hasChanges={hasChanges}
        status={flowStatus}
        onToggleStatus={onToggleStatus}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            defaultViewport={initialData.viewport ?? { x: 0, y: 0, zoom: 1 }}
            fitView={!initialData.viewport}
            className="bg-slate-900"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={20} />
            <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600" />
          </ReactFlow>
        </div>
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={onUpdateNode}
            onClose={() => setSelectedNode(null)}
            onDelete={onDeleteNode}
          />
        )}
      </div>
    </div>
  )
}
