"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { apiBase } from "@/lib/api-core";
import { useLocale } from "@/lib/i18n";

type LiveContextValue = { newConvCount: number };
const LiveContext = createContext<LiveContextValue>({ newConvCount: 0 });
export const useLive = () => useContext(LiveContext);

type LiveEvent = {
  type: string;
  conversationId?: string;
  channelKind?: string;
  role?: string;
  preview?: string;
};

/**
 * Opens an authenticated SSE stream to /v1/live and turns tenant events into
 * live UI: a toast + Bisedat badge on new conversations, and a debounced
 * router.refresh() so the inbox list and any open thread update in real time.
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
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const al = locale === "al";

  const [newConvCount, setNewConvCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const onInbox = pathname.startsWith(`/tenants/${slug}/inbox`);

  // Clear the badge while the inbox is open.
  useEffect(() => {
    if (onInbox) setNewConvCount(0);
  }, [onInbox, pathname]);

  // Latest-value handler so the long-lived stream loop never goes stale.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef<(e: LiveEvent) => void>(() => {});
  handlerRef.current = (e: LiveEvent) => {
    if (e.type === "conversation.started") {
      if (!onInbox) setNewConvCount((n) => n + 1);
      setToast(al ? "Një bisedë e re ka filluar" : "A new conversation started");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    }
    // Debounced refresh re-fetches the current route's server components
    // (inbox list / open thread) so they reflect the new state.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 450);
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
      // Graceful cancel (no AbortError) of any in-flight stream read.
      reader?.cancel().catch(() => {});
    };
    // Reconnect only when the tenant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <LiveContext.Provider value={{ newConvCount }}>
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
