"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type TeamOverview } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/datetime";

function friendlyError(msg: string, al: boolean): string {
  if (msg.includes("seat_limit_reached"))
    return al
      ? "Keni arritur kufirin e vendeve. Përmirësoni planin për të shtuar më shumë."
      : "Seat limit reached. Upgrade your plan to add more.";
  if (msg.includes("already_a_member"))
    return al ? "Ky email është tashmë anëtar." : "That email is already a member.";
  if (msg.includes("cannot_") && msg.includes("owner"))
    return al ? "Pronari nuk mund të ndryshohet këtu." : "The owner can't be changed here.";
  return al ? "Diçka shkoi keq. Provoni përsëri." : "Something went wrong. Please try again.";
}

const roleLabel = (role: string, al: boolean) =>
  role === "owner"
    ? al
      ? "Pronar"
      : "Owner"
    : role === "admin"
      ? "Admin"
      : al
        ? "Anëtar"
        : "Member";

export function TeamManager({
  slug,
  initial,
}: {
  slug: string;
  initial: TeamOverview;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const al = locale === "al";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { seats, members, invitations } = initial;
  const full = seats.used >= seats.max;

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "", al));
    } finally {
      setBusy(false);
    }
  }

  function invite(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    void run(async () => {
      await api.inviteMember(slug, value, role);
      setEmail("");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Seat meter */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-brand-deep">
              {al ? "Vende të zëna" : "Seats used"}
            </div>
            <div className="mt-0.5 text-[12.5px] text-slate-500">
              {al
                ? "Anëtarë aktivë + ftesa në pritje"
                : "Active members + pending invites"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold text-brand-deep">
              {seats.used}
              <span className="text-slate-400">/{seats.max}</span>
            </div>
            {full ? (
              <div className="text-[11.5px] font-semibold text-accent-orange">
                {al ? "Kufiri u arrit" : "Limit reached"}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-blue transition-all"
            style={{
              width: `${Math.min(100, (seats.used / Math.max(1, seats.max)) * 100)}%`,
            }}
          />
        </div>
      </Card>

      {/* Invite form */}
      <Card>
        <div className="text-[13px] font-semibold text-brand-deep">
          {al ? "Fto një anëtar" : "Invite a member"}
        </div>
        <form onSubmit={invite} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={full || busy}
            placeholder={al ? "email@shembull.com" : "email@example.com"}
            className="min-w-[200px] flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-brand-blue disabled:bg-slate-50"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "agent")}
            disabled={full || busy}
            className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-brand-blue disabled:bg-slate-50"
          >
            <option value="agent">{al ? "Anëtar" : "Member"}</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={full || busy}
            className="rounded-[10px] bg-brand-blue px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {al ? "Fto" : "Invite"}
          </button>
        </form>
        {full ? (
          <p className="mt-2 text-[12px] text-slate-500">
            {al
              ? "Keni arritur kufirin e planit. Përmirësoni planin për të ftuar më shumë anëtarë."
              : "You've reached your plan limit. Upgrade to invite more members."}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[12.5px] font-medium text-red-600">{error}</p>
        ) : null}
      </Card>

      {/* Members */}
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-3 text-[13px] font-semibold text-brand-deep">
          {al ? "Anëtarët" : "Members"} ({members.length})
        </div>
        <div>
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 border-b border-slate-50 px-5 py-3 last:border-0"
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
                {(m.name ?? m.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-brand-deep">
                  {m.name || m.email}
                </div>
                {m.name ? (
                  <div className="truncate text-[12px] text-slate-400">
                    {m.email}
                  </div>
                ) : null}
              </div>
              <span
                className={`flex-none rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  m.role === "owner"
                    ? "bg-brand-deep/10 text-brand-deep"
                    : m.role === "admin"
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {roleLabel(m.role, al)}
              </span>
              {m.role !== "owner" ? (
                <div className="flex flex-none items-center gap-1.5">
                  <button
                    onClick={() =>
                      run(() =>
                        api.setMemberRole(
                          slug,
                          m.userId,
                          m.role === "admin" ? "agent" : "admin",
                        ),
                      )
                    }
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-[12px] font-medium text-brand-blue transition hover:bg-brand-blue/5 disabled:opacity-50"
                  >
                    {m.role === "admin"
                      ? al
                        ? "Bëje anëtar"
                        : "Make member"
                      : al
                        ? "Bëje admin"
                        : "Make admin"}
                  </button>
                  <button
                    onClick={() =>
                      run(() => api.removeMember(slug, m.userId))
                    }
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-[12px] font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {al ? "Hiq" : "Remove"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      {/* Pending invites */}
      {invitations.length > 0 ? (
        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-3 text-[13px] font-semibold text-brand-deep">
            {al ? "Ftesa në pritje" : "Pending invites"} ({invitations.length})
          </div>
          <div>
            {invitations.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 border-b border-slate-50 px-5 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-brand-ink">
                    {i.email}
                  </div>
                  <div className="text-[12px] text-slate-400">
                    {roleLabel(i.role, al)} ·{" "}
                    {al ? "skadon" : "expires"} {formatDate(i.expiresAt)}
                  </div>
                </div>
                <button
                  onClick={() => run(() => api.resendInvite(slug, i.id))}
                  disabled={busy}
                  className="flex-none rounded-md px-2 py-1 text-[12px] font-medium text-brand-blue transition hover:bg-brand-blue/5 disabled:opacity-50"
                >
                  {al ? "Ridërgo" : "Resend"}
                </button>
                <button
                  onClick={() => run(() => api.revokeInvite(slug, i.id))}
                  disabled={busy}
                  className="flex-none rounded-md px-2 py-1 text-[12px] font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {al ? "Anulo" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
