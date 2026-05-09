import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import type { DemoPreset } from "@/content/demos/types";
import type { CrawlResult } from "./crawler";

const presetCache = new Map<string, DemoPreset>();

export function loadPreset(slug: string): DemoPreset | null {
  const cached = presetCache.get(slug);
  if (cached) return cached;

  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  try {
    const path = join(process.cwd(), "content/demos", `${slug}.json`);
    const raw = readFileSync(path, "utf-8");
    const preset = JSON.parse(raw) as DemoPreset;
    presetCache.set(slug, preset);
    return preset;
  } catch {
    return null;
  }
}

export function presetToCrawl(preset: DemoPreset): CrawlResult {
  return {
    origin: preset.origin,
    pages: preset.pages.map((p) => ({
      url: p.url,
      title: p.title,
      text: p.text,
    })),
  };
}
