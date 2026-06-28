"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { apiBase, type Notification } from "@/lib/api-core";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";

type LiveContextValue = {
  /** Conversations with unread visitor messages (sidebar "Bisedat" badge). */
  unreadTotal: number;
  /** Recent activity feed (bell dropdown). */
  notifications: Notification[];
  /** Feed items newer than the last time the bell was opened. */
  unseenCount: number;
  /** Mark the bell feed seen (clears unseenCount). */
  markNotificationsSeen: () => void;
  /** Re-fetch unread + notifications (e.g. after marking a thread read). */
  refresh: () => void;
};

const LiveContext = createContext<LiveContextValue>({
  unreadTotal: 0,
  notifications: [],
  unseenCount: 0,
  markNotificationsSeen: () => {},
  refresh: () => {},
});
export const useLive = () => useContext(LiveContext);

type LiveEvent = {
  type: string;
  conversationId?: string;
  channelKind?: string;
};

const SEEN_KEY = "lidh.notifSeen";

/**
 * Opens an authenticated SSE stream to /v1/live and turns tenant events into
 * live UI: a toast on new conversations, plus debounced re-fetches of the
 * unread summary (sidebar badge) + notifications feed (bell), and a
 * router.refresh() so the inbox list/thread update in real time.
 */
export function LiveProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { locale } = useLocale();
  const al = locale === "al";

  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Load the "seen" marker once (client-only; survives reloads per browser).
  useEffect(() => {
    const v = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    setLastSeen(Number.isFinite(v) ? v : 0);
  }, []);

  const unseenCount = useMemo(
    () =>
      notifications.filter((n) => Date.parse(n.createdAt) > lastSeen).length,
    [notifications, lastSeen],
  );

  const markNotificationsSeen = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  }, []);

  const refresh = useCallback(() => {
    api
      .getUnread(slug)
      .then((u) => setUnreadTotal(u.total))
      .catch(() => {});
    api
      .listNotifications(slug)
      .then(setNotifications)
      .catch(() => {});
  }, [slug]);

  // Initial load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Latest-value handler so the long-lived stream loop never goes stale.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef<(e: LiveEvent) => void>(() => {});
  handlerRef.current = (e: LiveEvent) => {
    if (e.type === "conversation.started") {
      setToast(al ? "Një bisedë e re ka filluar" : "A new conversation started");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    }
    // Debounced: re-fetch unread + notifications and refresh the current route
    // (inbox list / open thread) so everything reflects the new state.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refresh();
      router.refresh();
    }, 450);
  };

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    async function connect() {
      try {
        const token = await getToken();
        if (closed) return;
        if (!token) {
          retry = setTimeout(connect, 5000);
          return;
        }
        const res = await fetch(`${apiBase}/v1/live?tenantSlug=${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (closed) return;
        if (!res.ok || !res.body) throw new Error(`live ${res.status}`);
        reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            let ev = "message";
            let data = "";
            for (const line of part.split("\n")) {
              if (line.indexOf("event:") === 0) ev = line.slice(6).trim();
              else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
            }
            if (ev !== "live") continue;
            try {
              handlerRef.current(JSON.parse(data) as LiveEvent);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch {
        /* network drop — fall through to reconnect */
      }
      if (!closed) retry = setTimeout(connect, 5000);
    }

    void connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      reader?.cancel().catch(() => {});
    };
    // Reconnect only when the tenant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <LiveContext.Provider
      value={{
        unreadTotal,
        notifications,
        unseenCount,
        markNotificationsSeen,
        refresh,
      }}
    >
      {children}
      {toast ? (
        <button
          onClick={() => {
            setToast(null);
            router.push(`/tenants/${slug}/inbox`);
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-xl"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-blue" />
          </span>
          <span className="text-[13px] font-semibold text-brand-deep">
            {toast}
          </span>
          <span className="text-[12px] font-semibold text-brand-blue">
            {al ? "Shiko →" : "View →"}
          </span>
        </button>
      ) : null}
    </LiveContext.Provider>
  );
}
