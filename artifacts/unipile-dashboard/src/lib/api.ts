const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function fetchUnipileStatus() {
  const r = await fetch(`${BASE}/api/unipile/status`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    ok: boolean;
    error?: string;
    accounts: Array<{ id: string; name: string; type: string; status: string; createdAt: string | null }>;
    host: string;
    webhookUrl: string | null;
    accountCount: number;
  }>;
}

export async function fetchWebhookEvents() {
  const r = await fetch(`${BASE}/api/unipile/events`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    events: Array<{
      id: string;
      receivedAt: string;
      event: string;
      accountId: string | null;
      provider: string | null;
      summary: string;
      raw: unknown;
    }>;
    total: number;
  }>;
}

export function createEventStream(onEvents: (events: any[]) => void) {
  const url = `${BASE}/api/unipile/events/stream`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvents(data.events ?? []);
    } catch {}
  };
  return es;
}
