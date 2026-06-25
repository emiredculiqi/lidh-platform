import { api } from "@/lib/api-server";
import type { ConversationListItem } from "@/lib/api-core";
import { InboxShell } from "@/components/inbox/InboxShell";

export const dynamic = "force-dynamic";

// Master-detail inbox: the conversation list stays mounted (left), the
// selected thread + contact panel render via the /[conversationId] child.
export default async function InboxLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let conversations: ConversationListItem[] = [];
  try {
    conversations = await api.listConversations(slug);
  } catch {
    // render an empty list; the page surfaces nothing
  }

  return (
    <InboxShell slug={slug} conversations={conversations}>
      {children}
    </InboxShell>
  );
}
