import neo4j, { type Driver, type Session } from "neo4j-driver"

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

export class Neo4jService {
  private driver: Driver
  private session: Session

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j", process.env.NEO4J_PASSWORD || "password"),
    )
    this.session = this.driver.session()
  }

  async findEntity(label: string, type: string): Promise<Entity | null> {
    try {
      const result = await this.session.run(`MATCH (n:${type} {label: $label}) RETURN n`, { label })

      if (result.records.length > 0) {
        const node = result.records[0].get("n")
        return {
          id: node.identity.toString(),
          label: node.properties.label,
          type: type,
          properties: node.properties,
        }
      }

      return null
    } catch (error) {
      console.error("Error finding entity:", error)
      return null
    }
  }

  async createEntity(entity: Omit<Entity, "id">): Promise<Entity> {
    try {
      const propertiesString = Object.entries(entity.properties)
        .map(([key, value]) => `${key}: $${key}`)
        .join(", ")

      const query = `
        CREATE (n:${entity.type} {label: $label, ${propertiesString}})
        RETURN n
      `

      const result = await this.session.run(query, {
        label: entity.label,
        ...entity.properties,
      })

      const node = result.records[0].get("n")
      return {
        id: node.identity.toString(),
        label: node.properties.label,
        type: entity.type,
        properties: node.properties,
      }
    } catch (error) {
      console.error("Error creating entity:", error)
      throw error
    }
  }

  async updateEntity(id: string, properties: Record<string, any>): Promise<Entity> {
    try {
      const setClause = Object.keys(properties)
        .map((key) => `n.${key} = $${key}`)
        .join(", ")

      const query = `
        MATCH (n) WHERE id(n) = $id
        SET ${setClause}
        RETURN n, labels(n) as labels
      `

      const result = await this.session.run(query, {
        id: Number.parseInt(id),
        ...properties,
      })

      const node = result.records[0].get("n")
      const labels = result.records[0].get("labels")

      return {
        id: node.identity.toString(),
        label: node.properties.label,
        type: labels[0],
        properties: node.properties,
      }
    } catch (error) {
      console.error("Error updating entity:", error)
      throw error
    }
  }

  async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    properties: Record<string, any> = {},
  ): Promise<Relationship> {
    try {
      const propertiesString = Object.entries(properties)
        .map(([key, value]) => `${key}: $${key}`)
        .join(", ")

      const query = `
        MATCH (a), (b)
        WHERE id(a) = $sourceId AND id(b) = $targetId
        CREATE (a)-[r:${type} {${propertiesString}}]->(b)
        RETURN r, id(a) as sourceId, id(b) as targetId
      `

      const result = await this.session.run(query, {
        sourceId: Number.parseInt(sourceId),
        targetId: Number.parseInt(targetId),
        ...properties,
      })

      const relationship = result.records[0].get("r")
      const returnedSourceId = result.records[0].get("sourceId")
      const returnedTargetId = result.records[0].get("targetId")

      return {
        id: relationship.identity.toString(),
        source: returnedSourceId.toString(),
        target: returnedTargetId.toString(),
        type: type,
        properties: relationship.properties,
      }
    } catch (error) {
      console.error("Error creating relationship:", error)
      throw error
    }
  }

  async getAllEntitiesAndRelationships(): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    try {
      // Get all entities
      const entitiesResult = await this.session.run("MATCH (n) RETURN n, labels(n) as labels")
      const entities: Entity[] = entitiesResult.records.map((record) => {
        const node = record.get("n")
        const labels = record.get("labels")
        return {
          id: node.identity.toString(),
          label: node.properties.label || "Unknown",
          type: labels[0] || "Unknown",
          properties: node.properties,
        }
      })

      // Get all relationships
      const relationshipsResult = await this.session.run(
        "MATCH (a)-[r]->(b) RETURN r, id(a) as sourceId, id(b) as targetId, type(r) as relType",
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
