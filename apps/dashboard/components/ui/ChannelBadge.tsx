const CH: Record<string, { label: string; cls: string }> = {
  web: { label: "Web", cls: "bg-blue-50 text-brand-blue" },
  whatsapp: { label: "WhatsApp", cls: "bg-emerald-50 text-emerald-600" },
  instagram: { label: "Instagram", cls: "bg-pink-50 text-pink-600" },
  messenger: { label: "Messenger", cls: "bg-cyan-50 text-cyan-600" },
};

export function ChannelBadge({ kind }: { kind: string }) {
  const c = CH[kind] ?? { label: kind, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}
