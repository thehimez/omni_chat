import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetConversationsQueryKey,
  getGetConversationQueryKey,
  getGetConnectedAccountsQueryKey,
} from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function useRealtime() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(2000);
  const mountedRef = useRef(true);

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
  }, [queryClient]);

  const invalidateConversation = useCallback((id: string) => {
    queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) });
  }, [queryClient]);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // Clerk session cookie is sent automatically for same-origin EventSource requests.
      // The Vite proxy forwards /api/* to the API server, making it appear same-origin.
      const url = `${API_BASE}/api/events`;

      let es: EventSource;
      try {
        es = new EventSource(url);
      } catch {
        return;
      }
      esRef.current = es;

      es.addEventListener("connected", () => {
        delayRef.current = 1000;
      });

      es.addEventListener("new_message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { conversationId?: string };
          invalidateConversations();
          if (data.conversationId) {
            invalidateConversation(data.conversationId);
          }
        } catch {}
      });

      es.addEventListener("conversation_updated", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { conversationId?: string };
          invalidateConversations();
          if (data.conversationId) {
            invalidateConversation(data.conversationId);
          }
        } catch {}
      });

      es.addEventListener("sync_complete", () => {
        invalidateConversations();
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      });

      es.addEventListener("account_sync_started", () => {
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      });

      es.addEventListener("account_sync_finished", () => {
        invalidateConversations();
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      });

      es.addEventListener("account_updated", () => {
        queryClient.invalidateQueries({ queryKey: getGetConnectedAccountsQueryKey() });
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!mountedRef.current) return;
        const delay = Math.min(delayRef.current, 10000);
        delayRef.current = delay + 1000;
        reconnectRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [invalidateConversations, invalidateConversation, queryClient]);
}
