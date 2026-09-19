"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Personal star on a thread (ADR-024 §2). Optimistic: flips at once, reverts
 * on failure. `onChange` lets a list re-order itself without waiting for the
 * server round-trip; `router.refresh()` then brings the server views in line.
 */
export function StarButton({
  conversationId,
  starred,
  size = 18,
  onChange,
  className = "",
}: {
  conversationId: string;
  starred: boolean;
  size?: number;
  onChange?: (starred: boolean) => void;
  className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(starred);
  const [busy, setBusy] = useState(false);
  const t = useT({
    al: { star: "Shto te të preferuarat", unstar: "Hiq nga të preferuarat" },
    en: { star: "Add to favorites", unstar: "Remove from favorites" },
  });

  async function toggle() {
    if (busy) return;
    const next = !on;
    setOn(next);
    onChange?.(next);
    setBusy(true);
    try {
      await api.setConversationStar(conversationId, next);
      router.refresh();
    } catch {
      setOn(!next);
      onChange?.(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
      aria-pressed={on}
      aria-label={on ? t.unstar : t.star}
      title={on ? t.unstar : t.star}
      className={`inline-flex items-center justify-center rounded-md p-1 transition ${
        on ? "text-amber-400 hover:text-amber-500" : "text-slate-300 hover:text-amber-400"
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5z" />
      </svg>
    </button>
  );
}
