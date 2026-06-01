"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Tenant lifecycle controls (ADR-008): archive ⇄ reactivate (reversible,
// data kept) and hard delete (irreversible, type-the-slug confirmation).
// Server component passes the tenant's id/slug/status in.
export function TenantLifecycle({
  id,
  slug,
  status,
}: {
  id: string;
  slug: string;
  status: "active" | "archived";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "archive" | "reactivate" | "delete">(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  async function run(
    action: "archive" | "reactivate" | "delete",
    fn: () => Promise<unknown>,
    after: () => void,
  ) {
    setBusy(action);
    setErr(null);
    try {
      await fn();
      after();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-brand-ink/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-deep">
            Lifecycle
          </h2>
          <p className="text-sm text-brand-ink/55">
            Current status:{" "}
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                status === "active"
                  ? "bg-brand-mint/20 text-brand-deep"
                  : "bg-accent-orange/15 text-accent-orange"
              }`}
            >
              {status}
            </span>
          </p>
        </div>

        {status === "active" ? (
          <button
            disabled={busy !== null}
            onClick={() =>
              run(
                "archive",
                () => api.archiveTenant(id),
                () => router.refresh(),
              )
            }
            className="rounded-lg border border-accent-orange/40 px-4 py-2 text-sm font-medium text-accent-orange transition hover:bg-accent-orange/5 disabled:opacity-50"
          >
            {busy === "archive" ? "Archiving…" : "Archive (pause service)"}
          </button>
        ) : (
          <button
            disabled={busy !== null}
            onClick={() =>
              run(
                "reactivate",
                () => api.reactivateTenant(id),
                () => router.refresh(),
              )
            }
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "reactivate" ? "Reactivating…" : "Reactivate"}
          </button>
        )}
      </div>

      {status === "archived" ? (
        <p className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-sm text-brand-ink/70">
          Service is <strong>paused</strong>. The agent does not reply on any
          channel (web, demo, WhatsApp). All data is retained — reactivate any
          time.
        </p>
      ) : null}

      {/* Danger zone */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <p className="text-sm font-medium text-red-700">Danger zone</p>
        <p className="mt-1 text-xs text-red-700/80">
          Deleting removes the tenant and <strong>everything</strong> tied to
          it — agent, knowledge, conversations, leads, contacts, usage and
          uploaded documents. This cannot be undone.
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Delete permanently…
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-red-700">
              Type the slug{" "}
              <code className="rounded bg-white px-1 py-0.5">{slug}</code> to
              confirm:
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={slug}
              className="w-full rounded border border-red-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                disabled={typed !== slug || busy !== null}
                onClick={() =>
                  run(
                    "delete",
                    () => api.deleteTenant(id),
                    () => {
                      router.push("/tenants");
                      router.refresh();
                    },
                  )
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {busy === "delete"
                  ? "Deleting…"
                  : "I understand — delete forever"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setTyped("");
                }}
                className="rounded-lg px-4 py-2 text-sm text-brand-ink/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </section>
  );
}
