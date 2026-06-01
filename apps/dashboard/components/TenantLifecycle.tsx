"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

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

  const t = useT({
    al: {
      heading: "Cikli i jetës",
      currentStatus: "Statusi aktual: ",
      statusActive: "aktiv",
      statusArchived: "arkivuar",
      archiveBtn: "Arkivo (pezullo shërbimin)",
      archiving: "Duke arkivuar…",
      reactivateBtn: "Riaktivizo",
      reactivating: "Duke riaktivizuar…",
      archivedNoticeStart: "Shërbimi është ",
      archivedNoticeBold: "i pezulluar",
      archivedNoticeEnd:
        ". Agjenti nuk përgjigjet në asnjë kanal (web, funel, WhatsApp). Të gjitha të dhënat ruhen — riaktivizoje në çdo kohë.",
      dangerZone: "Zona e rrezikut",
      dangerDesc1: "Fshirja heq biznesin dhe ",
      dangerDescBold: "gjithçka",
      dangerDesc2:
        " që lidhet me të — agjentin, njohuritë, bisedat, klientët potencialë, kontaktet, përdorimin dhe dokumentet e ngarkuara. Ky veprim nuk mund të kthehet pas.",
      deletePermanently: "Fshi përgjithmonë…",
      typeSlugStart: "Shkruaj slug-un ",
      typeSlugEnd: " për të konfirmuar:",
      iUnderstand: "E kuptoj — fshi përgjithmonë",
      deleting: "Duke fshirë…",
      cancel: "Anulo",
      defaultErr: "dështoi",
    },
    en: {
      heading: "Lifecycle",
      currentStatus: "Current status: ",
      statusActive: "active",
      statusArchived: "archived",
      archiveBtn: "Archive (pause service)",
      archiving: "Archiving…",
      reactivateBtn: "Reactivate",
      reactivating: "Reactivating…",
      archivedNoticeStart: "Service is ",
      archivedNoticeBold: "paused",
      archivedNoticeEnd:
        ". The agent does not reply on any channel (web, funnel, WhatsApp). All data is retained — reactivate any time.",
      dangerZone: "Danger zone",
      dangerDesc1: "Deleting removes the tenant and ",
      dangerDescBold: "everything",
      dangerDesc2:
        " tied to it — agent, knowledge, conversations, leads, contacts, usage and uploaded documents. This cannot be undone.",
      deletePermanently: "Delete permanently…",
      typeSlugStart: "Type the slug ",
      typeSlugEnd: " to confirm:",
      iUnderstand: "I understand — delete forever",
      deleting: "Deleting…",
      cancel: "Cancel",
      defaultErr: "failed",
    },
  });

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
      setErr(e instanceof Error ? e.message : t.defaultErr);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-brand-ink/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-deep">
            {t.heading}
          </h2>
          <p className="text-sm text-brand-ink/55">
            {t.currentStatus}
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                status === "active"
                  ? "bg-brand-mint/20 text-brand-deep"
                  : "bg-accent-orange/15 text-accent-orange"
              }`}
            >
              {status === "active" ? t.statusActive : t.statusArchived}
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
            {busy === "archive" ? t.archiving : t.archiveBtn}
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
            {busy === "reactivate" ? t.reactivating : t.reactivateBtn}
          </button>
        )}
      </div>

      {status === "archived" ? (
        <p className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-sm text-brand-ink/70">
          {t.archivedNoticeStart}
          <strong>{t.archivedNoticeBold}</strong>
          {t.archivedNoticeEnd}
        </p>
      ) : null}

      {/* Danger zone */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <p className="text-sm font-medium text-red-700">{t.dangerZone}</p>
        <p className="mt-1 text-xs text-red-700/80">
          {t.dangerDesc1}
          <strong>{t.dangerDescBold}</strong>
          {t.dangerDesc2}
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            {t.deletePermanently}
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-red-700">
              {t.typeSlugStart}
              <code className="rounded bg-white px-1 py-0.5">{slug}</code>
              {t.typeSlugEnd}
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
                {busy === "delete" ? t.deleting : t.iUnderstand}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setTyped("");
                }}
                className="rounded-lg px-4 py-2 text-sm text-brand-ink/60"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </section>
  );
}
