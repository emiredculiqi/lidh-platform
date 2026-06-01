"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

/**
 * Inline translation for server components (which can't call useT directly).
 *
 *   <T al="Tenantët" en="Tenants" />
 *
 * Renders as a single fragment so it slots cleanly into <h1>, <p>, table
 * headers, etc. For larger surfaces with many strings, use a translation
 * bundle from `content/dashboard.ts` inside a client component instead —
 * sprinkling <T> everywhere gets noisy fast.
 */
export function T({ al, en }: { al: ReactNode; en: ReactNode }) {
  return <>{useT({ al, en })}</>;
}
