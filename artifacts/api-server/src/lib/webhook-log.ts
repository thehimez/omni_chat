export type WebhookLogEntry = {
  id: string;
  receivedAt: string;
  event: string;
  accountId: string | null;
  provider: string | null;
  summary: string;
  raw: unknown;
};

const MAX_ENTRIES = 100;
const log: WebhookLogEntry[] = [];

export function appendWebhookEvent(entry: Omit<WebhookLogEntry, "id" | "receivedAt">): void {
  log.unshift({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    receivedAt: new Date().toISOString(),
    ...entry,
  });
  if (log.length > MAX_ENTRIES) log.splice(MAX_ENTRIES);
}

export function getWebhookLog(): WebhookLogEntry[] {
  return [...log];
}
