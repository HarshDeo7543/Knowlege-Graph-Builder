import { GeminiNLPProcessor } from "./gemini-nlp-processor"
import { LocalNLPProcessor } from "./local-nlp-processor"

interface Entity {
  label: string
  type: string
  properties: Record<string, any>
  confidence: number
  aliases?: string[]
}

interface Relationship {
  source: string
  target: string
  type: string
  properties: Record<string, any>
  confidence: number
  context: string
}

interface ExtractionResult {
  entities: Entity[]
  relationships: Relationship[]
}

export class HybridNLPProcessor {
  private geminiProcessor: GeminiNLPProcessor
  private localProcessor: LocalNLPProcessor

  constructor() {
    this.geminiProcessor = new GeminiNLPProcessor()
    this.localProcessor = new LocalNLPProcessor()
  }

  async extractEntitiesAndRelationships(text: string): Promise<ExtractionResult> {
    console.log("Starting hybrid NLP processing...")

    // First try Gemini if API key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("Attempting Gemini processing...")
        const result = await this.geminiProcessor.extractEntitiesAndRelationships(text)

        // If we got results from Gemini, use them
        if (result.entities.length > 0 || result.relationships.length > 0) {
          console.log("Gemini processing successful")
          return result
        }
      } catch (error) {
        console.warn("Gemini processing failed, falling back to local NLP:", error)
      }
    }

    // Fallback to local processing
    console.log("Using local NLP processing...")
    const result = await this.localProcessor.extractEntitiesAndRelationships(text)

    // Enhance local results if needed
    return this.enhanceLocalResults(result, text)
  }

  private enhanceLocalResults(result: ExtractionResult, text: string): ExtractionResult {
    // Add additional processing to improve local results
    const enhancedEntities = result.entities.map((entity) => ({
      ...entity,
      properties: {
        ...entity.properties,
        enhanced: true,
        originalText: text,
        processingMethod: "local",
      },
    }))

    const enhancedRelationships = result.relationships.map((relationship) => ({
      ...relationship,
      properties: {
        ...relationship.properties,
        enhanced: true,
        originalText: text,
        processingMethod: "local",
      },
    }))

    return {
      entities: enhancedEntities,
      relationships: enhancedRelationships,
    }
  }
}
