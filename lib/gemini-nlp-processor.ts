import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

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

export class GeminiNLPProcessor {
  private readonly ENTITY_TYPES = [
    "PERSON",
    "ORGANIZATION",
    "COMPANY",
    "LOCATION",
    "EVENT",
    "PRODUCT",
    "TECHNOLOGY",
    "CONCEPT",
    "DATE",
    "MONEY",
    "PERCENTAGE",
    "FOOD",
    "ANIMAL",
    "OBJECT",
    "VEHICLE",
    "BUILDING",
    "BOOK",
    "MOVIE",
    "SONG",
    "PROFESSION",
    "ATTRIBUTE",
    "ACTION",
    "BRAND",
  ]

  private readonly RELATIONSHIP_TYPES = [
    "FOUNDED_BY",
    "OWNS",
    "IS_A",
    "HAS_ATTRIBUTE",
    "WORKS_AT",
    "CEO_OF",
    "LIVES_IN",
    "BORN_IN",
    "STUDIED_AT",
    "FRIENDS_WITH",
    "CLASSMATES_WITH",
    "COLLEAGUES_WITH",
    "FAMILY_OF",
    "PARENT_OF",
    "CHILD_OF",
    "SIBLING_OF",
    "MARRIED_TO",
    "USES",
    "LIKES",
    "LOVES",
    "HATES",
    "EATS",
    "DRINKS",
    "READS",
    "WRITES",
    "PLAYS",
    "TEACHES",
    "LEARNS",
    "CREATES",
    "DESTROYS",
    "VISITS",
    "TRAVELS_TO",
    "WORKS_WITH",
    "COLLABORATES_WITH",
    "COMPETES_WITH",
    "HELPS",
    "SUPPORTS",
    "OPPOSES",
    "LEADS",
    "FOLLOWS",
    "MANAGES",
    "REPORTS_TO",
  ]

  async extractEntitiesAndRelationships(text: string): Promise<ExtractionResult> {
    try {
      console.log(`Processing text with Gemini Flash: "${text}"`)

      // Use optimized single-call processing
      const result = await this.extractEntitiesAndRelationshipsInOneCall(text)

      console.log(
        `Gemini extracted ${result.entities.length} entities and ${result.relationships.length} relationships`,
      )

      return {
        entities: this.filterEntities(result.entities),
        relationships: this.filterRelationships(result.relationships, result.entities),
      }
    } catch (error) {
      console.error("Error in Gemini NLP processing:", error)
      throw error
    }
  }

  private async extractEntitiesAndRelationshipsInOneCall(text: string): Promise<ExtractionResult> {
    const prompt = `
    Analyze the following text and extract ALL entities and relationships. Focus ONLY on the actual content, ignore any technical or implementation details.

    Text: "${text}"

    IMPORTANT RULES:
    - Extract ONLY from the actual text content provided
    - For "Apple is founded by Steve Jobs", extract: Apple (COMPANY), Steve Jobs (PERSON), relationship: Apple FOUNDED_BY Steve Jobs
    - For "Elon Musk owns Tesla", extract: Elon Musk (PERSON), Tesla (COMPANY), relationship: Elon Musk OWNS Tesla  
    - For "He is Very Rich", extract: He (PERSON), Rich (ATTRIBUTE), relationship: He HAS_ATTRIBUTE Rich
    - Focus on people, companies, products, attributes, and their relationships
    - Ignore any PDF/DOCX processing terms, file formats, or technical implementation details
    - Use high confidence (0.85+) for clear entities and relationships

    Entity types: ${this.ENTITY_TYPES.join(", ")}
    Relationship types: ${this.RELATIONSHIP_TYPES.join(", ")}

    Return ONLY valid JSON in this exact format:
    {
      "entities": [
        {
          "label": "entity name exactly as in text",
          "type": "ENTITY_TYPE",
          "confidence": 0.95,
          "properties": {
            "description": "brief description",
            "context": "context from text"
          },
          "aliases": []
        }
      ],
      "relationships": [
        {
          "source": "source entity name",
          "target": "target entity name", 
          "type": "RELATIONSHIP_TYPE",
          "confidence": 0.9,
          "context": "sentence showing relationship",
          "properties": {
            "description": "relationship description"
          }
        }
      ]
    }
    `

    try {
      // Use gemini-1.5-flash for fastest processing
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      })

      const result = await model.generateContent(prompt)
      const response = await result.response
      const content = response.text()

      if (!content) {
        console.warn("No content in Gemini response")
        return { entities: [], relationships: [] }
      }

      console.log("Raw Gemini response:", content)

      // Clean and parse JSON
      const cleanedContent = content
        .replace(/```json\n?|\n?```/g, "")
        .replace(/```\n?|\n?```/g, "")
        .trim()

      const parsed = JSON.parse(cleanedContent)

      return {
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
      }
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError)
      return { entities: [], relationships: [] }
    }
  }

  private filterEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>()
    const filtered: Entity[] = []

    for (const entity of entities) {
      if (!entity || !entity.label) continue

      const normalizedLabel = entity.label.toLowerCase().trim()

      // Skip technical/implementation terms
      if (this.isTechnicalTerm(entity.label)) {
        continue
      }

      if (normalizedLabel.length > 0 && !seen.has(normalizedLabel) && !this.isVeryGenericEntity(entity)) {
        seen.add(normalizedLabel)
        filtered.push(entity)
      }
    }

    return filtered.sort((a, b) => b.confidence - a.confidence)
  }

  private filterRelationships(relationships: Relationship[], entities: Entity[]): Relationship[] {
    const entityLabels = new Set(entities.map((e) => e.label.toLowerCase()))

    return relationships.filter((rel) => {
      if (!rel || !rel.source || !rel.target) return false

      // Skip technical relationships
      if (this.isTechnicalTerm(rel.source) || this.isTechnicalTerm(rel.target)) {
        return false
      }

      const sourceExists = entityLabels.has(rel.source.toLowerCase())
      const targetExists = entityLabels.has(rel.target.toLowerCase())
      const notSelfRelation = rel.source.toLowerCase() !== rel.target.toLowerCase()

      return sourceExists && targetExists && notSelfRelation && rel.confidence >= 0.7
    })
  }

  private isTechnicalTerm(term: string): boolean {
    const technicalTerms = [
      "pdf",
      "docx",
      "file",
      "text",
      "document",
      "conversion",
      "selectable",
      "parsing",
      "extraction",
      "processing",
      "format",
      "content",
      "stream",
      "object",
      "implementation",
      "library",
      "javascript",
      "mammoth",
      "buffer",
      "array",
      "string",
      "method",
      "function",
      "class",
    ]

    return technicalTerms.some((tech) => term.toLowerCase().includes(tech.toLowerCase()))
  }

  private isVeryGenericEntity(entity: Entity): boolean {
    if (!entity || !entity.label) return true

    const veryGenericPatterns = [
      /^(a|an|the|this|that|these|those)$/i,
      /^(very|quite|rather|some|any|all)$/i,
      /^\d+$/,
      /^[a-z]$/i,
    ]

    return veryGenericPatterns.some((pattern) => pattern.test(entity.label))
  }
}
