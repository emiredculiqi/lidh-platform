"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Per-row delete for the Tenants table. Opens a confirmation modal that
// requires typing the tenant's exact name — the same irreversible cascade
// delete as the Agent-page lifecycle control (ADR-008).
export function TenantDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setErr(null);
  }

  async function confirmDelete() {
    if (typed !== name || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.deleteTenant(id);
      setOpen(false);
      setTyped("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        Delete
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-brand-deep">
              Delete tenant
            </h2>
            <p className="text-sm text-brand-ink/70">
              This permanently removes <strong>{name}</strong> and{" "}
              <strong>everything</strong> tied to it — agent, knowledge,
              conversations, leads, contacts, usage and uploaded documents.
              This cannot be undone.
            </p>
            <label className="block text-xs text-brand-ink/60">
              Type the tenant name{" "}
              <code className="rounded bg-brand-fog px-1 py-0.5">{name}</code>{" "}
              to confirm:
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              className="w-full rounded border border-red-300 px-3 py-2 text-sm"
            />
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-brand-ink/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={typed !== name || busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
