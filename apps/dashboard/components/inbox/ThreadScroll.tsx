"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// React 18 warns about useLayoutEffect during server rendering; the usual
// isomorphic alias keeps the first paint already scrolled on the client.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The scrollable message column of a thread. Opens at the newest message (a
 * thread is read bottom-up) and follows new messages only while the reader
 * is already near the bottom — someone who scrolled up to read history is
 * not yanked down when the customer writes. Key it by conversation id so a
 * different thread starts at its own bottom.
 */
export function ThreadScroll({
  signal,
  className,
  children,
}: {
  /** Changes when the thread gains a message (e.g. its message count). */
  signal: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const first = useRef(true);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (nearBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [signal]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className={className}
    >
      {children}
    </div>
  );
}
