import type { ReactNode } from "react";
import { Card } from "./Card";

/** A single KPI tile: label, big value, optional delta pill + sub-line. */
export function KpiStat({
  label,
  value,
  sub,
  delta,
  up = true,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  delta?: string;
  up?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-medium text-slate-500">{label}</div>
        {delta ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              up
                ? "bg-emerald-50 text-emerald-600"
                : "bg-orange-50 text-orange-600"
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <div className="mt-2 font-display text-[28px] font-bold leading-none text-brand-deep">
        {value}
      </div>
      {sub ? <div className="mt-2 text-xs text-slate-400">{sub}</div> : null}
    </Card>
  );
}
