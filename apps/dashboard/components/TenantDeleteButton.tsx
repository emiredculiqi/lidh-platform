"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

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

  const t = useT({
    al: {
      delete: "Fshi",
      modalTitle: "Fshi biznesin",
      warningBefore: "Kjo heq përgjithmonë ",
      warningAnd: " dhe ",
      warningEverything: "gjithçka",
      warningAfter:
        " që lidhet me të — agjentin, njohuritë, bisedat, klientët potencialë, kontaktet, përdorimin dhe dokumentet e ngarkuara. Veprimi nuk mund të kthehet pas.",
      typeNameBefore: "Shkruaj emrin e biznesit ",
      typeNameAfter: " për të konfirmuar:",
      cancel: "Anulo",
      deleting: "Duke fshirë…",
      confirm: "Fshi përgjithmonë",
      defaultErr: "fshirja dështoi",
    },
    en: {
      delete: "Delete",
      modalTitle: "Delete tenant",
      warningBefore: "This permanently removes ",
      warningAnd: " and ",
      warningEverything: "everything",
      warningAfter:
        " tied to it — agent, knowledge, conversations, leads, contacts, usage and uploaded documents. This cannot be undone.",
      typeNameBefore: "Type the tenant name ",
      typeNameAfter: " to confirm:",
      cancel: "Cancel",
      deleting: "Deleting…",
      confirm: "Delete forever",
      defaultErr: "delete failed",
    },
  });

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
      setErr(e instanceof Error ? e.message : t.defaultErr);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        {t.delete}
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
              {t.modalTitle}
            </h2>
            <p className="text-sm text-brand-ink/70">
              {t.warningBefore}
              <strong>{name}</strong>
              {t.warningAnd}
              <strong>{t.warningEverything}</strong>
              {t.warningAfter}
            </p>
            <label className="block text-xs text-brand-ink/60">
              {t.typeNameBefore}
              <code className="rounded bg-brand-fog px-1 py-0.5">{name}</code>
              {t.typeNameAfter}
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
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={typed !== name || busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? t.deleting : t.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
