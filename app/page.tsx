"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Upload, FileText, Database, Activity, Trash2, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import GraphVisualization from "@/components/graph-visualization"
import ProcessingStatus from "@/components/processing-status"

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

export default function KnowledgeGraphBuilder() {
  const [textInput, setTextInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [graphData, setGraphData] = useState<GraphData>({ entities: [], relationships: [] })
  const [processingStatus, setProcessingStatus] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [clearBeforeProcessing, setClearBeforeProcessing] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const allowedTypes = [".txt", ".pdf", ".docx"]
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase()

      if (allowedTypes.includes(fileExtension)) {
        setSelectedFile(file)
        toast({
          title: "File selected",
          description: `${file.name} is ready for processing`,
        })
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a .txt, .pdf, or .docx file",
          variant: "destructive",
        })
      }
    }
  }

  const clearGraph = async () => {
    try {
      setIsProcessing(true)
      setProcessingStatus(["Clearing graph data..."])

      const response = await fetch("/api/clear-graph", {
        method: "POST",
      })

      if (response.ok) {
        setGraphData({ entities: [], relationships: [] })
        setProcessingStatus(["Graph cleared successfully!"])
        toast({
          title: "Graph cleared",
          description: "All previous data has been removed",
        })
      } else {
        throw new Error("Failed to clear graph")
      }
    } catch (error) {
      toast({
        title: "Clear failed",
        description: "Failed to clear graph data",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processText = async (text: string) => {
    setIsProcessing(true)
    setProcessingStatus(["Starting text processing..."])

    try {
      const response = await fetch("/api/process-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          clearBefore: clearBeforeProcessing,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to process text")
      }

      const result = await response.json()

      // Update the graph data
      setGraphData({
        entities: result.entities || [],
        relationships: result.relationships || [],
      })

      setProcessingStatus([
        "Text processing completed!",
        `Extracted ${result.entitiesCount} entities`,
        `Created ${result.relationshipsCount} relationships`,
        `Processing method: ${result.processingMethod || "hybrid"}`,
      ])

      toast({
        title: "Processing completed",
        description: `Extracted ${result.entitiesCount} entities and ${result.relationshipsCount} relationships`,
      })
    } catch (error) {
      setProcessingStatus(["Processing failed: " + (error instanceof Error ? error.message : "Unknown error")])
      toast({
        title: "Processing failed",
        description: "An error occurred while processing the text",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processFile = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setProcessingStatus(["Starting file processing..."])

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("clearBefore", clearBeforeProcessing.toString())

    try {
      const response = await fetch("/api/process-file", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to process file")
      }

      const result = await response.json()

      // Update the graph data
      setGraphData({
        entities: result.entities || [],
        relationships: result.relationships || [],
      })

      setProcessingStatus([
        "File processing completed!",
        `File: ${result.fileInfo?.name}`,
        `Extracted ${result.entitiesCount} entities`,
        `Created ${result.relationshipsCount} relationships`,
        `Processing method: ${result.processingMethod || "hybrid"}`,
      ])

      toast({
        title: "File processed successfully",
        description: `Extracted ${result.entitiesCount} entities and ${result.relationshipsCount} relationships`,
      })
    } catch (error) {
      setProcessingStatus(["Processing failed: " + (error instanceof Error ? error.message : "Unknown error")])
      toast({
        title: "File processing failed",
        description: "An error occurred while processing the file",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      processText(textInput)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Graph Builder</h1>
          <p className="text-gray-600">Extract entities and relationships from text and visualize them in real-time</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Input & Upload */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <FileText className="h-5 w-5" />
                Input & Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Settings Section */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Processing Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="clear-before"
                      checked={clearBeforeProcessing}
                      onCheckedChange={setClearBeforeProcessing}
                    />
                    <Label htmlFor="clear-before" className="text-sm">
                      Clear existing data before processing
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {clearBeforeProcessing
                      ? "New data will replace existing graph"
                      : "New data will be added to existing graph"}
                  </p>
                </CardContent>
              </Card>

              {/* Text Input Section */}
              <div className="space-y-2">
                <Label htmlFor="text-input">Paste your text here:</Label>
                <Textarea
                  id="text-input"
                  placeholder="Enter any text with entities and relationships... 
Example: 'John works at Google and lives in California. He is friends with Sarah who studies at Stanford University.'"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="min-h-[150px] resize-none"
                  disabled={isProcessing}
                />
                <Button onClick={handleTextSubmit} disabled={!textInput.trim() || isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Process Text
                    </>
                  )}
                </Button>
              </div>

              {/* File Upload Section */}
              <div className="space-y-2">
                <Label htmlFor="file-input">Or upload a file:</Label>
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
                  <Input
                    ref={fileInputRef}
                    id="file-input"
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-blue-500" />
                    <div>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                        Choose File
                      </Button>
                      <p className="text-sm text-gray-500 mt-2">
                        {selectedFile ? selectedFile.name : "No file chosen"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400">Supported formats: .txt, .pdf, .docx</p>
                  </div>
                </div>
                {selectedFile && (
                  <Button onClick={processFile} disabled={isProcessing} className="w-full bg-black hover:bg-gray-800">
                    {isProcessing ? (
                      <>
                        <Activity className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Process
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Clear Graph Button */}
              <div className="pt-4 border-t">
                <Button onClick={clearGraph} disabled={isProcessing} variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Graph
                </Button>
              </div>

              {/* Processing Status */}
              {(isProcessing || processingStatus.length > 0) && (
                <ProcessingStatus status={processingStatus} isProcessing={isProcessing} />
              )}
            </CardContent>
          </Card>

          {/* Right Panel - Graph Visualization */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Database className="h-5 w-5" />
                Knowledge Graph Visualization
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full">
              <GraphVisualization data={graphData} isProcessing={isProcessing} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
