import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require an authenticated user. Anything not matched here is
// treated as public (the marketing-style root, /sign-in, /sign-up, webhooks).
//
// Add new protected paths here as we build them out (M2: /leads, /agent,
// /knowledge, /channels, /test, /settings, /tenants).
const isProtectedRoute = createRouteMatcher([
  "/inbox(.*)",
  "/leads(.*)",
  "/agent(.*)",
  "/knowledge(.*)",
  "/channels(.*)",
  "/test(.*)",
  "/settings(.*)",
  "/tenants(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals + static asset files; run on every dynamic route.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API + tRPC routes.
    "/(api|trpc)(.*)",
  ],
};
