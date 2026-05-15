// Empty stub. In M2 this becomes the unified conversation list across channels.
// Auth gate will be added in substep 4.4 via Clerk middleware + a route group.
export default function InboxPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-brand-deep">
        Inbox
      </h1>
      <p className="mt-3 text-brand-ink/70">
        Conversations across web widget, WhatsApp and Instagram will land here
        in M2.
      </p>
    </main>
  );
}
