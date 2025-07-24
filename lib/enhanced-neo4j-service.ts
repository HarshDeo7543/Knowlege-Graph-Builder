import neo4j, { type Driver, type Session } from "neo4j-driver"

interface Entity {
  id: string
  label: string
  type: string
  properties: Record<string, any>
  confidence?: number
  aliases?: string[]
}

interface Relationship {
  id: string
  source: string
  target: string
  type: string
  properties: Record<string, any>
  confidence?: number
}

export class EnhancedNeo4jService {
  private driver: Driver
  private session: Session

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j", process.env.NEO4J_PASSWORD || "password"),
    )
    this.session = this.driver.session()
  }

  async clearAllData(): Promise<void> {
    try {
      // Delete all relationships first
      await this.session.run("MATCH ()-[r]-() DELETE r")

      // Then delete all nodes
      await this.session.run("MATCH (n) DELETE n")

      console.log("All graph data cleared")
    } catch (error) {
      console.error("Error clearing graph data:", error)
      throw error
    }
  }

  async findEntityByLabelAndType(label: string, type: string): Promise<Entity | null> {
    try {
      const result = await this.session.run(
        `MATCH (n:${type}) 
         WHERE toLower(n.label) = toLower($label) OR 
               any(alias in coalesce(n.aliases, []) WHERE toLower(alias) = toLower($label))
         RETURN n LIMIT 1`,
        { label },
      )

      if (result.records.length > 0) {
        const node = result.records[0].get("n")
        return {
          id: node.identity.toString(),
          label: node.properties.label,
          type: type,
          properties: node.properties,
          confidence: node.properties.confidence || 1.0,
          aliases: node.properties.aliases || [],
        }
      }

      return null
    } catch (error) {
      console.error("Error finding entity:", error)
      return null
    }
  }

  async findSimilarEntities(label: string, type: string, threshold = 0.8): Promise<Entity[]> {
    try {
      // Simple similarity check without APOC
      const result = await this.session.run(
        `MATCH (n:${type})
         WHERE toLower(n.label) CONTAINS toLower($label) OR toLower($label) CONTAINS toLower(n.label)
         RETURN n
         LIMIT 5`,
        { label, threshold },
      )

      return result.records.map((record) => {
        const node = record.get("n")
        return {
          id: node.identity.toString(),
          label: node.properties.label,
          type: type,
          properties: node.properties,
          confidence: node.properties.confidence || 1.0,
          aliases: node.properties.aliases || [],
        }
      })
    } catch (error) {
      console.error("Error finding similar entities:", error)
      return []
    }
  }

  async createEntityWithMerge(entity: Omit<Entity, "id">): Promise<Entity> {
    try {
      const query = `
        MERGE (n:${entity.type} {label: $label})
        ON CREATE SET 
          n.confidence = $confidence,
          n.aliases = $aliases,
          n.created_at = datetime(),
          n += $properties
        ON MATCH SET 
          n.confidence = CASE WHEN $confidence > coalesce(n.confidence, 0) THEN $confidence ELSE n.confidence END,
          n.aliases = CASE WHEN $aliases IS NOT NULL THEN 
            coalesce(n.aliases, []) + $aliases
            ELSE n.aliases END,
          n.updated_at = datetime(),
          n += $properties
        RETURN n
      `

      const result = await this.session.run(query, {
        label: entity.label,
        confidence: entity.confidence || 0.8,
        aliases: entity.aliases || [],
        properties: entity.properties || {},
      })

      const node = result.records[0].get("n")
      return {
        id: node.identity.toString(),
        label: node.properties.label,
        type: entity.type,
        properties: node.properties,
        confidence: node.properties.confidence,
        aliases: node.properties.aliases,
      }
    } catch (error) {
      console.error("Error creating entity:", error)
      throw error
    }
  }

  async createRelationshipWithValidation(
    sourceLabel: string,
    targetLabel: string,
    sourceType: string,
    targetType: string,
    relationshipType: string,
    properties: Record<string, any> = {},
  ): Promise<Relationship | null> {
    try {
      // First, ensure both entities exist
      const sourceEntity = await this.findEntityByLabelAndType(sourceLabel, sourceType)
      const targetEntity = await this.findEntityByLabelAndType(targetLabel, targetType)

      if (!sourceEntity || !targetEntity) {
        console.warn(`Cannot create relationship: source (${sourceLabel}) or target (${targetLabel}) not found`)
        return null
      }

      // Check if relationship already exists
      const existingRel = await this.findRelationship(sourceEntity.id, targetEntity.id, relationshipType)
      if (existingRel) {
        console.log(`Relationship already exists: ${sourceLabel} -[${relationshipType}]-> ${targetLabel}`)
        return existingRel
      }

      const query = `
        MATCH (a:${sourceType} {label: $sourceLabel})
        MATCH (b:${targetType} {label: $targetLabel})
        CREATE (a)-[r:${relationshipType}]->(b)
        SET r += $properties
        SET r.created_at = datetime()
        SET r.confidence = $confidence
        RETURN r, id(a) as sourceId, id(b) as targetId
      `

      const result = await this.session.run(query, {
        sourceLabel,
        targetLabel,
        properties,
        confidence: properties.confidence || 0.8,
      })

      if (result.records.length === 0) {
        return null
      }

      const relationship = result.records[0].get("r")
      const sourceId = result.records[0].get("sourceId")
      const targetId = result.records[0].get("targetId")

      return {
        id: relationship.identity.toString(),
        source: sourceId.toString(),
        target: targetId.toString(),
        type: relationshipType,
        properties: relationship.properties,
        confidence: relationship.properties.confidence,
      }
    } catch (error) {
      console.error("Error creating relationship:", error)
      return null
    }
  }

  private async findRelationship(sourceId: string, targetId: string, type: string): Promise<Relationship | null> {
    try {
      const result = await this.session.run(
        `MATCH (a)-[r:${type}]->(b) 
         WHERE id(a) = $sourceId AND id(b) = $targetId 
         RETURN r, id(a) as sourceId, id(b) as targetId`,
        {
          sourceId: Number.parseInt(sourceId),
          targetId: Number.parseInt(targetId),
        },
      )

      if (result.records.length > 0) {
        const relationship = result.records[0].get("r")
        const srcId = result.records[0].get("sourceId")
        const tgtId = result.records[0].get("targetId")

        return {
          id: relationship.identity.toString(),
          source: srcId.toString(),
          target: tgtId.toString(),
          type: type,
          properties: relationship.properties,
          confidence: relationship.properties.confidence,
        }
      }

      return null
    } catch (error) {
      console.error("Error finding relationship:", error)
      return null
    }
  }

  async getAllEntitiesAndRelationships(): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    try {
      // Get all entities
      const entitiesResult = await this.session.run(
        `MATCH (n) 
         RETURN n, labels(n) as labels 
         ORDER BY coalesce(n.confidence, 1.0) DESC, n.label`,
      )

      const entities: Entity[] = entitiesResult.records.map((record) => {
        const node = record.get("n")
        const labels = record.get("labels")
        return {
          id: node.identity.toString(),
          label: node.properties.label || "Unknown",
          type: labels[0] || "Unknown",
          properties: node.properties,
          confidence: node.properties.confidence || 1.0,
          aliases: node.properties.aliases || [],
        }
      })

      // Get all relationships
      const relationshipsResult = await this.session.run(
        `MATCH (a)-[r]->(b) 
         RETURN r, id(a) as sourceId, id(b) as targetId, type(r) as relType, a.label as sourceLabel, b.label as targetLabel
         ORDER BY coalesce(r.confidence, 1.0) DESC`,
      )

      const relationships: Relationship[] = relationshipsResult.records.map((record) => {
        const relationship = record.get("r")
        const sourceId = record.get("sourceId")
        const targetId = record.get("targetId")
        const relType = record.get("relType")

        return {
          id: relationship.identity.toString(),
          source: sourceId.toString(),
          target: targetId.toString(),
          type: relType,
          properties: relationship.properties,
          confidence: relationship.properties.confidence || 1.0,
        }
      })

      return { entities, relationships }
    } catch (error) {
      console.error("Error getting all entities and relationships:", error)
      throw error
    }
  }

  async close(): Promise<void> {
    await this.session.close()
    await this.driver.close()
  }
}
