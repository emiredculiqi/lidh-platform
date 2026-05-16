import type { CrawledPage } from "./crawler";

const TARGET = 900; // ~chars per chunk (good for text-embedding-3-small)
const OVERLAP = 150; // carry-over chars to preserve context across splits
const MIN_CHARS = 60; // drop near-empty fragments

export interface Chunk {
  content: string;
  meta: { url: string; title: string };
}

/**
 * Split crawled pages into overlapping passages. Each chunk is prefixed with
 * the page title so an isolated chunk still carries context for retrieval.
 * Splits prefer sentence/whitespace boundaries to avoid cutting mid-word.
 */
export function chunkPages(pages: CrawledPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    const clean = page.text.replace(/\s+/g, " ").trim();
    if (clean.length < MIN_CHARS) continue;

    let i = 0;
    while (i < clean.length) {
      let end = Math.min(i + TARGET, clean.length);
      if (end < clean.length) {
        // back off to the last sentence end or space within the window
        const window = clean.slice(i, end);
        const lastStop = Math.max(
          window.lastIndexOf(". "),
          window.lastIndexOf("! "),
          window.lastIndexOf("? "),
          window.lastIndexOf("\n"),
        );
        const lastSpace = window.lastIndexOf(" ");
        const cut = lastStop > TARGET * 0.5 ? lastStop + 1 : lastSpace > 0 ? lastSpace : window.length;
        end = i + cut;
      }
      const body = clean.slice(i, end).trim();
      if (body.length >= MIN_CHARS) {
        chunks.push({
          content: `${page.title}\n\n${body}`,
          meta: { url: page.url, title: page.title },
        });
      }
      if (end >= clean.length) break;
      i = Math.max(end - OVERLAP, i + 1);
    }
  }
  return chunks;
}
