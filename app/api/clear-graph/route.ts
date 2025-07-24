import { type NextRequest, NextResponse } from "next/server"
import { EnhancedNeo4jService } from "@/lib/enhanced-neo4j-service"

export async function POST(request: NextRequest) {
  try {
    console.log("Clearing all graph data...")

    const neo4jService = new EnhancedNeo4jService()

    // Clear all nodes and relationships
    await neo4jService.clearAllData()

    console.log("Graph data cleared successfully!")
    await neo4jService.close()

    return NextResponse.json({
      success: true,
      message: "Graph data cleared successfully",
    })
  } catch (error) {
    console.error("Error clearing graph data:", error)
    return NextResponse.json(
      {
        error: "Failed to clear graph data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
