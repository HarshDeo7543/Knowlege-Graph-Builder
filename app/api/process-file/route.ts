import { type NextRequest, NextResponse } from "next/server"
import { EnhancedFileProcessor } from "@/lib/enhanced-file-processor"
import { SimplePDFExtractor } from "@/lib/simple-pdf-extractor"
import { HybridNLPProcessor } from "@/lib/hybrid-nlp-processor"
import { EnhancedNeo4jService } from "@/lib/enhanced-neo4j-service"

export async function POST(request: NextRequest) {
  try {
    console.log("File processing API called")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const clearBefore = formData.get("clearBefore") === "true"

    if (!file) {
      console.error("No file provided in request")
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`)
    console.log(`Clear before processing: ${clearBefore}`)

    const fileProcessor = new EnhancedFileProcessor()
    const nlpProcessor = new HybridNLPProcessor()
    const neo4jService = new EnhancedNeo4jService()

    try {
      // Clear previous data only if requested
      if (clearBefore) {
        console.log("Clearing previous graph data...")
        await neo4jService.clearAllData()
      }

      // Extract text based on file type
      let rawText = ""
      const fileExtension = file.name.split(".").pop()?.toLowerCase()

      if (fileExtension === "pdf") {
        console.log("Using specialized PDF extractor...")
        rawText = await SimplePDFExtractor.extractText(file)
      } else {
        console.log("Using standard file processor...")
        rawText = await fileProcessor.extractTextFromFile(file)
      }

      console.log(`Raw text length: ${rawText.length} characters`)

      const cleanText = fileProcessor.preprocessText(rawText)
      console.log(`Clean text length: ${cleanText.length} characters`)
      console.log(`Extracted content: "${cleanText.substring(0, 200)}..."`)

      if (cleanText.length === 0) {
        throw new Error("No text content extracted from file")
      }

      // Process text with hybrid NLP
      console.log("Starting NLP processing...")
      const { entities, relationships } = await nlpProcessor.extractEntitiesAndRelationships(cleanText)

      console.log(`NLP extracted ${entities.length} entities and ${relationships.length} relationships`)

      const processedEntities = []
      const processedRelationships = []

      // Process entities
      console.log("Processing entities...")
      for (const entity of entities) {
        try {
          console.log(`Creating entity: ${entity.label} (${entity.type})`)
          const newEntity = await neo4jService.createEntityWithMerge(entity)
          processedEntities.push(newEntity)
        } catch (error) {
          console.error(`Error processing entity ${entity.label}:`, error)
        }
      }

      // Process relationships
      console.log("Processing relationships...")
      for (const relationship of relationships) {
        try {
          const sourceEntity = processedEntities.find(
            (e) => e.label.toLowerCase() === relationship.source.toLowerCase(),
          )
          const targetEntity = processedEntities.find(
            (e) => e.label.toLowerCase() === relationship.target.toLowerCase(),
          )

          if (sourceEntity && targetEntity) {
            console.log(
              `Creating relationship: ${relationship.source} -[${relationship.type}]-> ${relationship.target}`,
            )
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
                source_file: file.name,
              },
            )

            if (newRelationship) {
              processedRelationships.push(newRelationship)
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

      // Get final graph data
      console.log("Retrieving final graph data...")
      const graphData = await neo4jService.getAllEntitiesAndRelationships()

      console.log("File processing completed successfully!")
      console.log(
        `Final result: ${graphData.entities.length} entities, ${graphData.relationships.length} relationships`,
      )

      await neo4jService.close()

      return NextResponse.json({
        success: true,
        entitiesCount: processedEntities.length,
        relationshipsCount: processedRelationships.length,
        entities: graphData.entities,
        relationships: graphData.relationships,
        fileInfo: {
          name: file.name,
          size: file.size,
          textLength: cleanText.length,
          extractedText: cleanText.substring(0, 100) + "...", // Show first 100 chars for debugging
        },
        processingMethod: entities.length > 0 ? "gemini" : "local",
      })
    } catch (processingError) {
      console.error("Error during file processing:", processingError)
      await neo4jService.close()
      throw processingError
    }
  } catch (error) {
    console.error("Error in file processing API:", error)
    return NextResponse.json(
      {
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
