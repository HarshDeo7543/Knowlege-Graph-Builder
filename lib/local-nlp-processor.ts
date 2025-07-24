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

export class LocalNLPProcessor {
  private readonly ENTITY_PATTERNS = {
    PERSON: [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // Capitalized names
      /\b(Mr|Mrs|Dr|Prof|Sir|Madam|Miss)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    ],
    ORGANIZATION: [
      /\b([A-Z][a-z]+(?:\s+(?:Inc|Corp|LLC|Ltd|Company|University|School|College))\b)/gi,
      /\b(Google|Microsoft|Apple|Tesla|SpaceX|OpenAI|Facebook|Amazon|Netflix|Uber)\b/gi,
    ],
    LOCATION: [
      /\b([A-Z][a-z]+(?:\s+(?:City|State|Country|Street|Avenue|Road|Place|Park))\b)/gi,
      /\b(New York|Los Angeles|London|Paris|Tokyo|Delhi|Mumbai|California|Texas|India|USA|America)\b/gi,
    ],
    FOOD: [
      /\b(apple|mango|banana|orange|pizza|burger|sandwich|rice|bread|cake|cookie|chocolate|ice cream|coffee|tea|milk|water|juice)\b/gi,
    ],
    TECHNOLOGY: [/\b(computer|laptop|phone|smartphone|tablet|software|app|website|internet|AI|robot|drone)\b/gi],
    OBJECT: [/\b(car|bike|house|book|pen|paper|chair|table|door|window|bag|box|bottle|cup|glass)\b/gi],
  }

  private readonly RELATIONSHIP_PATTERNS = [
    {
      pattern: /(\w+)\s+(?:eats?|eating|ate)\s+(\w+)/gi,
      type: "EATS",
      confidence: 0.9,
    },
    {
      pattern: /(\w+)\s+(?:loves?|loving|loved)\s+(\w+)/gi,
      type: "LOVES",
      confidence: 0.9,
    },
    {
      pattern: /(\w+)\s+(?:likes?|liking|liked)\s+(\w+)/gi,
      type: "LIKES",
      confidence: 0.9,
    },
    {
      pattern: /(\w+)\s+(?:works?\s+at|employed\s+by)\s+(\w+)/gi,
      type: "WORKS_AT",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:lives?\s+in|resides?\s+in)\s+(\w+)/gi,
      type: "LIVES_IN",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:knows?|knowing|knew)\s+(\w+)/gi,
      type: "KNOWS",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:owns?|owning|owned)\s+(\w+)/gi,
      type: "OWNS",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:uses?|using|used)\s+(\w+)/gi,
      type: "USES",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:has|have|having|had)\s+(\w+)/gi,
      type: "HAS",
      confidence: 0.7,
    },
    {
      pattern: /(\w+)\s+(?:reads?|reading|read)\s+(\w+)/gi,
      type: "READS",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:drives?|driving|drove)\s+(\w+)/gi,
      type: "DRIVES",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:plays?|playing|played)\s+(\w+)/gi,
      type: "PLAYS",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:teaches?|teaching|taught)\s+(\w+)/gi,
      type: "TEACHES",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:studies?|studying|studied)\s+(\w+)/gi,
      type: "STUDIES",
      confidence: 0.8,
    },
    {
      pattern: /(\w+)\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(\w+)/gi,
      type: "IS_A",
      confidence: 0.7,
    },
  ]

  async extractEntitiesAndRelationships(text: string): Promise<ExtractionResult> {
    console.log(`Processing text with local NLP: "${text}"`)

    const entities = this.extractEntities(text)
    const relationships = this.extractRelationships(text, entities)

    console.log(`Local NLP extracted ${entities.length} entities and ${relationships.length} relationships`)

    return {
      entities: this.filterEntities(entities),
      relationships: this.filterRelationships(relationships, entities),
    }
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = []
    const foundEntities = new Set<string>()

    // Extract entities using patterns
    for (const [entityType, patterns] of Object.entries(this.ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(text)) !== null) {
          const entityLabel = match[1] || match[0]
          const normalizedLabel = entityLabel.trim().toLowerCase()

          if (normalizedLabel.length > 1 && !foundEntities.has(normalizedLabel)) {
            foundEntities.add(normalizedLabel)
            entities.push({
              label: this.capitalizeFirst(entityLabel.trim()),
              type: entityType,
              confidence: 0.85,
              properties: {
                context: text,
                extractedBy: "local-nlp",
              },
              aliases: [],
            })
          }
        }
      }
    }

    // Extract capitalized words as potential entities if not already found
    const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || []
    for (const word of capitalizedWords) {
      const normalizedWord = word.toLowerCase()
      if (!foundEntities.has(normalizedWord) && word.length > 2) {
        foundEntities.add(normalizedWord)
        entities.push({
          label: word,
          type: this.guessEntityType(word, text),
          confidence: 0.7,
          properties: {
            context: text,
            extractedBy: "local-nlp",
            guessed: true,
          },
          aliases: [],
        })
      }
    }

    // Extract common nouns as objects
    const commonNouns = text.match(/\b[a-z]+\b/g) || []
    for (const noun of commonNouns) {
      if (noun.length > 2 && !foundEntities.has(noun) && this.isLikelyNoun(noun)) {
        foundEntities.add(noun)
        entities.push({
          label: this.capitalizeFirst(noun),
          type: "OBJECT",
          confidence: 0.6,
          properties: {
            context: text,
            extractedBy: "local-nlp",
            commonNoun: true,
          },
          aliases: [],
        })
      }
    }

    console.log(
      "Extracted entities:",
      entities.map((e) => `${e.label} (${e.type})`),
    )
    return entities
  }

  private extractRelationships(text: string, entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = []
    const entityLabels = entities.map((e) => e.label.toLowerCase())

    for (const relationshipPattern of this.RELATIONSHIP_PATTERNS) {
      let match
      while ((match = relationshipPattern.pattern.exec(text)) !== null) {
        const source = this.capitalizeFirst(match[1].trim())
        const target = this.capitalizeFirst(match[2].trim())

        // Check if both entities exist in our extracted entities
        const sourceExists = entityLabels.includes(source.toLowerCase())
        const targetExists = entityLabels.includes(target.toLowerCase())

        if (sourceExists && targetExists && source.toLowerCase() !== target.toLowerCase()) {
          relationships.push({
            source,
            target,
            type: relationshipPattern.type,
            confidence: relationshipPattern.confidence,
            context: match[0],
            properties: {
              extractedBy: "local-nlp",
              originalMatch: match[0],
            },
          })
        }
      }
    }

    console.log(
      "Extracted relationships:",
      relationships.map((r) => `${r.source} -[${r.type}]-> ${r.target}`),
    )
    return relationships
  }

  private guessEntityType(word: string, context: string): string {
    const lowerWord = word.toLowerCase()
    const lowerContext = context.toLowerCase()

    // Check context for clues
    if (lowerContext.includes(`${lowerWord} eats`) || lowerContext.includes(`${lowerWord} lives`)) {
      return "PERSON"
    }

    if (lowerContext.includes(`eat ${lowerWord}`) || lowerContext.includes(`eating ${lowerWord}`)) {
      return "FOOD"
    }

    // Common name patterns
    const commonNames = [
      "ram",
      "john",
      "mary",
      "david",
      "sarah",
      "mike",
      "anna",
      "tom",
      "lisa",
      "alex",
      "sam",
      "emma",
      "jack",
      "lucy",
    ]
    if (commonNames.includes(lowerWord)) {
      return "PERSON"
    }

    // Default to CONCEPT for capitalized words
    return "CONCEPT"
  }

  private isLikelyNoun(word: string): boolean {
    const commonNouns = [
      "apple",
      "mango",
      "banana",
      "orange",
      "book",
      "car",
      "house",
      "dog",
      "cat",
      "computer",
      "phone",
      "table",
      "chair",
      "food",
      "water",
      "coffee",
      "tea",
      "pizza",
      "burger",
    ]
    return commonNouns.includes(word.toLowerCase())
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  private filterEntities(entities: Entity[]): Entity[] {
    // Remove duplicates and very short entities
    const seen = new Set<string>()
    const filtered: Entity[] = []

    for (const entity of entities) {
      const normalizedLabel = entity.label.toLowerCase()

      if (normalizedLabel.length > 1 && !seen.has(normalizedLabel)) {
        seen.add(normalizedLabel)
        filtered.push(entity)
      }
    }

    return filtered.sort((a, b) => b.confidence - a.confidence)
  }

  private filterRelationships(relationships: Relationship[], entities: Entity[]): Relationship[] {
    const entityLabels = new Set(entities.map((e) => e.label.toLowerCase()))

    return relationships.filter((rel) => {
      const sourceExists = entityLabels.has(rel.source.toLowerCase())
      const targetExists = entityLabels.has(rel.target.toLowerCase())
      const notSelfRelation = rel.source.toLowerCase() !== rel.target.toLowerCase()

      return sourceExists && targetExists && notSelfRelation
    })
  }
}
