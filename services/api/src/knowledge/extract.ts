// Text extraction per document type. Used by document upload (M2.5.5).
// Each extractor turns a file buffer into plain text; the rest of the
// pipeline (chunk → embed → store) is shared with crawling.

function ext(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim().toLowerCase());
  return m ? m[1] : "";
}

export const SUPPORTED_DOC_EXTS = [
  "pdf",
  "docx",
  "xlsx",
  "xls",
  "txt",
  "md",
  "csv",
] as const;

export function isSupportedDoc(filename: string): boolean {
  return (SUPPORTED_DOC_EXTS as readonly string[]).includes(ext(filename));
}

/** Extract readable text from a document buffer. Throws with a clear message
 *  on unsupported type or empty extraction (mapped to the fail-loud UX). */
export async function extractText(
  filename: string,
  buf: Buffer,
): Promise<string> {
  const e = ext(filename);
  let text = "";

  if (e === "pdf") {
    // pdf-parse v2: named `pdf` export; fall back to default for safety.
    const mod = (await import("pdf-parse")) as unknown as {
      pdf?: (b: Buffer) => Promise<{ text: string }>;
      default?: (b: Buffer) => Promise<{ text: string }>;
    };
    const run = mod.pdf ?? mod.default;
    if (!run) throw new Error("pdf parser unavailable");
    text = (await run(buf)).text;
  } else if (e === "docx") {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText: (i: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (e === "xlsx" || e === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    text = wb.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return `# Sheet: ${name}\n${csv}`;
    }).join("\n\n");
  } else if (e === "txt" || e === "md" || e === "csv") {
    text = buf.toString("utf8");
  } else {
    throw new Error(
      `unsupported file type ".${e}" — supported: ${SUPPORTED_DOC_EXTS.join(", ")}`,
    );
  }

  text = text.replace(/\s+\n/g, "\n").trim();
  if (text.length < 20) {
    throw new Error("no_content_extracted");
  }
  return text;
}
