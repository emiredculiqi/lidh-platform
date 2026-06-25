import type { ReactNode } from "react";

/** Base surface for the redesigned dashboard — white, rounded, hairline border. */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
