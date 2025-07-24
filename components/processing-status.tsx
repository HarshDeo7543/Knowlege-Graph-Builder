"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle } from "lucide-react"

interface ProcessingStatusProps {
  status: string[]
  isProcessing: boolean
}

export default function ProcessingStatus({ status, isProcessing }: ProcessingStatusProps) {
  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {isProcessing ? (
            <>
              <Activity className="h-4 w-4 animate-spin text-blue-500" />
              Processing Status
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              Processing Complete
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {status.map((message, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">
                {index + 1}
              </Badge>
              <span className="text-gray-600">{message}</span>
            </div>
          ))}
          {status.length === 0 && isProcessing && (
            <div className="text-sm text-gray-500 italic">Initializing processing...</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
