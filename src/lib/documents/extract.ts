export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
}

export interface ExtractedDocument {
  pages: ExtractedPage[];
  pageCount: number;
}

/** Extract text from a PDF, one entry per page. */
export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  // Import the implementation file directly to avoid pdf-parse's index.js
  // debug harness that reads a bundled test PDF when run without a parent.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    data: Buffer,
    options?: Record<string, unknown>
  ) => Promise<{ numpages: number; text: string }>;

  const pages: ExtractedPage[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData: {
      getTextContent: (opts: Record<string, unknown>) => Promise<{
        items: { str: string }[];
      }>;
    }) => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      const text = content.items.map((i) => i.str).join(" ");
      pages.push({ pageNumber: pages.length + 1, text });
      return text;
    },
  });

  return { pages, pageCount: pages.length };
}

/** Extract text from a plain-text / markdown file (single "page"). */
export function extractText(buffer: Buffer): ExtractedDocument {
  return {
    pages: [{ pageNumber: null, text: buffer.toString("utf-8") }],
    pageCount: 1,
  };
}
