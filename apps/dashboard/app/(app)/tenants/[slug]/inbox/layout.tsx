import { api } from "@/lib/api-server";
import type { ConversationList } from "@/lib/api-core";
import { InboxShell } from "@/components/inbox/InboxShell";

export const dynamic = "force-dynamic";

// Master-detail inbox: the conversation list stays mounted (left), the
// selected thread + contact panel render via the /[conversationId] child.
//
// A layout can't read searchParams, so this fetches the UNFILTERED list for
// the first paint; when the URL carries filters (?q=&channel=&stage=&only=)
// the InboxShell fetches the filtered list itself, in the browser.
export default async function InboxLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let initial: ConversationList = { items: [], awaitingCount: 0, viewerUserId: null };
  try {
    initial = await api.listConversations(slug);
  } catch {
    // render an empty list; the page surfaces nothing
  }

  return (
    <InboxShell slug={slug} initial={initial}>
      {children}
    </InboxShell>
  );
}
