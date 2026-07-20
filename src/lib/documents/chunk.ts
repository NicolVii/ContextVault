export interface TextChunk {
  content: string;
  pageNumber: number | null;
  index: number;
}

interface PageInput {
  pageNumber: number | null;
  text: string;
}

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

function chunkString(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK_SIZE) return clean.length ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // Prefer to break on a sentence/word boundary.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" "));
      if (lastBreak > CHUNK_SIZE * 0.6) end = start + lastBreak + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}

/** Split extracted pages into overlapping, page-attributed chunks. */
export function chunkPages(pages: PageInput[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;
  for (const page of pages) {
    for (const content of chunkString(page.text)) {
      chunks.push({ content, pageNumber: page.pageNumber, index: index++ });
    }
  }
  return chunks;
}
