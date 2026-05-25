import type { Response } from "express";

interface SseClient {
  id: string;
  userId: string;
  res: Response;
}

const clients = new Map<string, SseClient>();

export function addSseClient(userId: string, res: Response): string {
  const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  clients.set(clientId, { id: clientId, userId, res });
  return clientId;
}

export function removeSseClient(clientId: string): void {
  clients.delete(clientId);
}

export function broadcastToUser(userId: string, eventType: string, data: unknown): void {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    if (client.userId === userId) {
      try {
        client.res.write(payload);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
