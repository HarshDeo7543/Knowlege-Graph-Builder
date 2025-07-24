import { type NextRequest, NextResponse } from "next/server"
import { HybridNLPProcessor } from "@/lib/hybrid-nlp-processor"
import { EnhancedNeo4jService } from "@/lib/enhanced-neo4j-service"

export async function POST(request: NextRequest) {
  try {
    const { text, clearBefore = true } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    console.log("Starting enhanced entity extraction...")
    console.log(`Input text: "${text}"`)
    console.log(`Clear before processing: ${clearBefore}`)

    const nlpProcessor = new HybridNLPProcessor()
    const neo4jService = new EnhancedNeo4jService()

    // Clear previous data only if requested
    if (clearBefore) {
      console.log("Clearing previous graph data...")
      await neo4jService.clearAllData()
    }

    // Extract entities and relationships using hybrid approach
    const { entities, relationships } = await nlpProcessor.extractEntitiesAndRelationships(text)

    console.log(`Extracted ${entities.length} entities and ${relationships.length} relationships`)

    const processedEntities = []
    const processedRelationships = []

    // Process each entity
    for (const entity of entities) {
      console.log(`Processing entity: ${entity.label} (${entity.type}) - Confidence: ${entity.confidence}`)

      try {
        const newEntity = await neo4jService.createEntityWithMerge(entity)
        processedEntities.push(newEntity)
        console.log(`Created entity: ${entity.label}`)
      } catch (error) {
        console.error(`Error processing entity ${entity.label}:`, error)
      }
    }

    // Process relationships
    for (const relationship of relationships) {
      console.log(`Processing relationship: ${relationship.source} -[${relationship.type}]-> ${relationship.target}`)

      try {
        const sourceEntity = processedEntities.find((e) => e.label.toLowerCase() === relationship.source.toLowerCase())

        const targetEntity = processedEntities.find((e) => e.label.toLowerCase() === relationship.target.toLowerCase())

        if (sourceEntity && targetEntity) {
          const newRelationship = await neo4jService.createRelationshipWithValidation(
            sourceEntity.label,
            targetEntity.label,
            sourceEntity.type,
            targetEntity.type,
            relationship.type,
            {
              ...relationship.properties,
              confidence: relationship.confidence,
              context: relationship.context,
            },
          )

          if (newRelationship) {
            processedRelationships.push(newRelationship)
            console.log(`Created relationship: ${relationship.source} -[${relationship.type}]-> ${relationship.target}`)
          }
        } else {
          console.warn(
            `Cannot create relationship: entities not found - ${relationship.source} or ${relationship.target}`,
          )
        }
      } catch (error) {
        console.error(`Error processing relationship:`, error)
      }
    }

    // Get updated graph data
    const graphData = await neo4jService.getAllEntitiesAndRelationships()

    console.log("Processing completed successfully!")
    console.log(`Final result: ${graphData.entities.length} entities, ${graphData.relationships.length} relationships`)

    await neo4jService.close()

    return NextResponse.json({
      success: true,
      entitiesCount: processedEntities.length,
      relationshipsCount: processedRelationships.length,
      entities: graphData.entities,
      relationships: graphData.relationships,
      processingMethod: entities.length > 0 ? "gemini" : "local",
      statistics: {
        extractedEntities: entities.length,
        extractedRelationships: relationships.length,
        processedEntities: processedEntities.length,
        processedRelationships: processedRelationships.length,
      },
    })
  } catch (error) {
    console.error("Error in text processing:", error)
    return NextResponse.json(
      {
        error: "Failed to process text",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
