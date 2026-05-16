import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Router only. Signed-in → /tenants (the admin home); signed-out → /sign-in.
export default async function HomePage() {
  const { userId } = await auth();
  redirect(userId ? "/tenants" : "/sign-in");
}
