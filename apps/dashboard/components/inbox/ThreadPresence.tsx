"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { TeamMemberRef, Viewer } from "@/lib/api-core";
import { useLive } from "@/components/shell/LiveProvider";

const HEARTBEAT_MS = 20_000;
const TYPING_IDLE_MS = 3_000;
const TYPING_REPEAT_MS = 4_000;

const TypingContext = createContext<() => void>(() => {});
/** Composer hook: call on every keystroke. */
export const useTypingReporter = () => useContext(TypingContext);

/**
 * Team awareness for an open thread (ADR-024 §3). Tells the API "I'm here"
 * every 20 s (and at once when typing starts/stops), listens for the
 * `presence` events of colleagues, and shows a soft warning above the
 * composer — never a lock — when someone else is on the same customer.
 */
export function ThreadPresence({
  conversationId,
  viewerUserId,
  initialViewers,
  assignedTo,
  children,
}: {
  conversationId: string;
  viewerUserId: string | null;
  initialViewers: Viewer[];
  assignedTo: TeamMemberRef | null;
  children: ReactNode;
}) {
  const { subscribe } = useLive();
  const [viewers, setViewers] = useState<Viewer[]>(initialViewers);
  const typingRef = useRef(false);
  const lastTypingSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useT({
    al: {
      typing: (n: string) => `${n} po shkruan…`,
      viewing: (n: string) => `${n} po e shikon gjithashtu këtë bisedë`,
      handling: (n: string) => `${n} po e trajton këtë bisedë`,
    },
    en: {
      typing: (n: string) => `${n} is typing…`,
      viewing: (n: string) => `${n} is also viewing this conversation`,
      handling: (n: string) => `${n} is handling this conversation`,
    },
  });

  const beat = useCallback(
    (typing: boolean) => {
      api.presence(conversationId, { typing }).then((r) => setViewers(r.viewers)).catch(() => {});
    },
    [conversationId],
  );

  // Heartbeat while mounted; say goodbye on unmount.
  useEffect(() => {
    beat(false);
    const id = setInterval(() => beat(typingRef.current), HEARTBEAT_MS);
    return () => {
      clearInterval(id);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      api.presence(conversationId, { leave: true }).catch(() => {});
    };
  }, [conversationId, beat]);

  // Colleagues' presence arrives on the live stream.
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === "presence" && e.conversationId === conversationId && e.viewers) {
          setViewers(e.viewers);
        }
      }),
    [subscribe, conversationId],
  );

  // Typing: send "typing" at most every 4 s while keys are pressed, and
  // "stopped" after 3 s of silence.
  const reportTyping = useCallback(() => {
    const now = Date.now();
    if (!typingRef.current || now - lastTypingSent.current > TYPING_REPEAT_MS) {
      typingRef.current = true;
      lastTypingSent.current = now;
      beat(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      typingRef.current = false;
      beat(false);
    }, TYPING_IDLE_MS);
  }, [beat]);

  const others = viewers.filter((v) => v.userId !== viewerUserId);
  const typing = others.filter((v) => v.typing);
  const names = (xs: { name: string | null }[]) =>
    xs.map((x) => x.name ?? "…").join(", ");

  let banner: { text: string; tone: "amber" | "slate" } | null = null;
  if (typing.length) banner = { text: t.typing(names(typing)), tone: "amber" };
  else if (others.length) banner = { text: t.viewing(names(others)), tone: "slate" };
  else if (assignedTo && assignedTo.userId !== viewerUserId)
    banner = { text: t.handling(assignedTo.name ?? "…"), tone: "slate" };

  return (
    <TypingContext.Provider value={reportTyping}>
      {banner ? (
        <div
          role="status"
          className={`flex flex-none items-center gap-2 border-t px-5 py-2 text-[12.5px] font-medium ${
            banner.tone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          <span
            className={`h-2 w-2 flex-none rounded-full ${
              banner.tone === "amber" ? "animate-pulse bg-amber-500" : "bg-slate-400"
            }`}
          />
          {banner.text}
        </div>
      ) : null}
      {children}
    </TypingContext.Provider>
  );
}
