"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLive } from "@/components/shell/LiveProvider";

/**
 * Marks a conversation read while its thread is open, then refreshes the inbox
 * list (router.refresh re-fetches the persistent inbox layout, clearing the row
 * badge) and the live totals (sidebar badge + bell). Renders nothing.
 *
 * `signal` changes every time the thread gains a message (the page re-fetches
 * on each live event), so a message arriving WHILE you're viewing re-marks the
 * thread read instead of leaving a stale badge until you navigate away.
 */
export function MarkRead({
  conversationId,
  signal,
}: {
  conversationId: string;
  signal?: number;
}) {
  const router = useRouter();
  const { refresh } = useLive();
  useEffect(() => {
    let cancelled = false;
    api
      .markConversationRead(conversationId)
      .then(() => {
        if (cancelled) return;
        router.refresh();
        refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Re-run when the open conversation changes OR it gains a message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, signal]);
  return null;
}
