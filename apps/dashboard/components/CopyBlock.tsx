"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

/** A code block with a copy-to-clipboard button. */
export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT({
    al: { copy: "Kopjo", copied: "U kopjua" },
    en: { copy: "Copy", copied: "Copied" },
  });

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-brand-ink/10 bg-brand-ink/[0.03] p-4 pr-20 text-xs leading-relaxed text-brand-ink/80">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-2 top-2 rounded-md border border-brand-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-brand-ink/70 transition hover:text-brand-deep"
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
