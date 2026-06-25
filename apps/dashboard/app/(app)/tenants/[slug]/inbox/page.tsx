import { T } from "@/components/T";

// Empty state shown (on desktop) when no conversation is selected. On mobile
// the list fills the screen, so this is hidden there by the InboxShell.
export default function InboxIndex() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v12H7l-3 3V4z" />
      </svg>
      <p className="text-sm text-slate-400">
        <T
          al="Zgjidh një bisedë nga lista."
          en="Select a conversation from the list."
        />
      </p>
    </div>
  );
}
