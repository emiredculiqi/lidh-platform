import { T } from "@/components/T";

const ST: Record<string, { al: string; en: string; cls: string }> = {
  open: { al: "Hapur", en: "Open", cls: "bg-orange-50 text-orange-600" },
  resolved: { al: "Zgjidhur", en: "Resolved", cls: "bg-emerald-50 text-emerald-600" },
  paused: { al: "Pezulluar", en: "Paused", cls: "bg-slate-100 text-slate-600" },
};

export function StatusPill({ status }: { status: string }) {
  const m = ST[status] ?? { al: status, en: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
      <T al={m.al} en={m.en} />
    </span>
  );
}
