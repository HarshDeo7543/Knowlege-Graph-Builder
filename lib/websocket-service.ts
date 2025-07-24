export class WebSocketService {
  private static instance: WebSocketService
  private clients: Set<any> = new Set()

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  addClient(client: any) {
    this.clients.add(client)
  }

  removeClient(client: any) {
    this.clients.delete(client)
  }

  broadcast(message: any) {
    const messageString = JSON.stringify(message)
    this.clients.forEach((client) => {
      try {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(messageString)
        }
      } catch (error) {
        console.error("Error broadcasting message:", error)
        this.clients.delete(client)
      }
    })
  }
}
