import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Root route is purely a router: signed-in users go straight to the inbox,
// signed-out users hit the Clerk sign-in flow. There's no marketing copy here
// because that lives on lidh.al (apps/marketing).
export default async function HomePage() {
  const { userId } = await auth();
  redirect(userId ? "/inbox" : "/sign-in");
}
