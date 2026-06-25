import { Card } from "@/components/ui/Card";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

// Placeholder — the calendar / appointment-booking feature is Phase 3.
export default async function CalendarPage() {
  return (
    <Card className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h18v16H3V5zm0 5h18M8 3v4m8-4v4" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-bold text-brand-deep">
        <T al="Kalendari po vjen së shpejti" en="Calendar coming soon" />
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        <T
          al="Së shpejti asistenti do të kapë takime dhe rezervime automatikisht nga bisedat dhe do t'i shfaqë këtu."
          en="Soon the assistant will capture appointments and bookings automatically from conversations and show them here."
        />
      </p>
    </Card>
  );
}
