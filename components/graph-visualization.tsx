"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Zap } from "lucide-react"

interface Entity {
  id: string
  label: string
  type: string
  properties: Record<string, any>
}

interface Relationship {
  id: string
  source: string
  target: string
  type: string
  properties: Record<string, any>
}

interface GraphData {
  entities: Entity[]
  relationships: Relationship[]
}

interface GraphVisualizationProps {
  data: GraphData
  isProcessing: boolean
}

interface Node extends Entity {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export default function GraphVisualization({ data, isProcessing }: GraphVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null)
  const [stats, setStats] = useState({ entities: 0, relationships: 0 })
  const [nodes, setNodes] = useState<Node[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    setStats({
      entities: data.entities.length,
      relationships: data.relationships.length,
    })
  }, [data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Initialize nodes
    const newNodes: Node[] = data.entities.map((entity, index) => ({
      ...entity,
      x: Math.random() * (rect.width - 100) + 50,
      y: Math.random() * (rect.height - 100) + 50,
      vx: 0,
      vy: 0,
      radius: Math.max(20, Math.min(40, entity.label.length * 3 + 15)),
    }))

    setNodes(newNodes)

    // Create links
    const links = data.relationships
      .map((rel) => ({
        ...rel,
        source: newNodes.find((n) => n.id === rel.source),
        target: newNodes.find((n) => n.id === rel.target),
      }))
      .filter((link) => link.source && link.target)

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height)

      if (newNodes.length === 0) {
        // Draw placeholder
        ctx.fillStyle = "#9CA3AF"
        ctx.font = "16px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("Graph visualization will appear here", rect.width / 2, rect.height / 2)
        ctx.fillText("after processing text or uploading files", rect.width / 2, rect.height / 2 + 25)
        return
      }

      // Simple force simulation
      for (let i = 0; i < newNodes.length; i++) {
        const nodeA = newNodes[i]

        // Repulsion between nodes
        for (let j = i + 1; j < newNodes.length; j++) {
          const nodeB = newNodes[j]
          const dx = nodeB.x - nodeA.x
          const dy = nodeB.y - nodeA.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 100) {
            const force = (100 - distance) / 100
            const fx = (dx / distance) * force * 2
            const fy = (dy / distance) * force * 2

            nodeA.vx -= fx
            nodeA.vy -= fy
            nodeB.vx += fx
            nodeB.vy += fy
          }
        }

        // Center attraction
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        const toCenterX = centerX - nodeA.x
        const toCenterY = centerY - nodeA.y
        nodeA.vx += toCenterX * 0.001
        nodeA.vy += toCenterY * 0.001

        // Apply velocity
        nodeA.vx *= 0.9 // Damping
        nodeA.vy *= 0.9
        nodeA.x += nodeA.vx
        nodeA.y += nodeA.vy

        // Boundary constraints
        nodeA.x = Math.max(nodeA.radius, Math.min(rect.width - nodeA.radius, nodeA.x))
        nodeA.y = Math.max(nodeA.radius, Math.min(rect.height - nodeA.radius, nodeA.y))
      }

      // Draw relationships
      ctx.strokeStyle = "#6B7280"
      ctx.lineWidth = 2
      links.forEach((link) => {
        if (link.source && link.target) {
          ctx.beginPath()
          ctx.moveTo(link.source.x, link.source.y)
          ctx.lineTo(link.target.x, link.target.y)
          ctx.stroke()

          // Draw relationship label
          const midX = (link.source.x + link.target.x) / 2
          const midY = (link.source.y + link.target.y) / 2
          ctx.fillStyle = "#374151"
          ctx.font = "12px Inter, sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(link.type, midX, midY - 5)
        }
      })

      // Draw entities
      newNodes.forEach((node) => {
        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI)
        ctx.fillStyle = getNodeColor(node.type)
        ctx.fill()
        ctx.strokeStyle = "#374151"
        ctx.lineWidth = 2
        ctx.stroke()

        // Node label
        ctx.fillStyle = "#FFFFFF"
        ctx.font = "bold 12px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(node.label, node.x, node.y + 4)
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [data])

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      PERSON: "#3B82F6",
      ORGANIZATION: "#10B981",
      LOCATION: "#F59E0B",
      EVENT: "#EF4444",
      CONCEPT: "#8B5CF6",
      FOOD: "#F97316",
      TECHNOLOGY: "#06B6D4",
      OBJECT: "#84CC16",
      default: "#6B7280",
    }
    return colors[type] || colors.default
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Find clicked node
    const clickedNode = nodes.find((node) => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
      return distance <= node.radius
    })

    setSelectedNode(clickedNode || null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {stats.entities} Entities
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {stats.relationships} Relationships
          </Badge>
        </div>
        {isProcessing && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3 animate-spin" />
            Processing...
          </Badge>
        )}
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full border rounded-lg cursor-pointer bg-white"
          onClick={handleCanvasClick}
        />

        {/* Node Details Panel */}
        {selectedNode && (
          <Card className="absolute top-4 right-4 p-4 max-w-xs">
            <h3 className="font-semibold text-lg">{selectedNode.label}</h3>
            <Badge className="mb-2">{selectedNode.type}</Badge>
            {Object.entries(selectedNode.properties).length > 0 && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Properties:</h4>
                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
