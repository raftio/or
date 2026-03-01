/**
 * Code-aware text chunking for embedding.
 *
 * Splits source files into overlapping line-based chunks with a file-path
 * preamble so the embedding captures location context.
 */

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
}

export interface ChunkOptions {
  /** Max lines per chunk (default 60). */
  chunkSize?: number;
  /** Overlap lines between consecutive chunks (default 10). */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 60;
const DEFAULT_OVERLAP = 10;

/**
 * Build a preamble that gives the embedding model file-level context.
 */
function preamble(filePath: string, language: string | null, startLine: number, endLine: number): string {
  const lang = language ? ` [${language}]` : "";
  return `// File: ${filePath} (lines ${startLine}-${endLine})${lang}\n`;
}

/**
 * Split a source file into overlapping chunks.
 *
 * Each chunk includes a short preamble with the file path, language, and
 * line range so the embedding captures positional context.
 */
export function chunkCode(
  filePath: string,
  content: string,
  language: string | null,
  options?: ChunkOptions,
): CodeChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const lines = content.split("\n");

  if (lines.length === 0) return [];

  // Small files fit in a single chunk
  if (lines.length <= chunkSize) {
    return [
      {
        content: preamble(filePath, language, 1, lines.length) + content,
        startLine: 1,
        endLine: lines.length,
      },
    ];
  }

  const step = Math.max(1, chunkSize - overlap);
  const chunks: CodeChunk[] = [];

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + chunkSize, lines.length);
    const startLine = start + 1;
    const endLine = end;
    const slice = lines.slice(start, end).join("\n");

    chunks.push({
      content: preamble(filePath, language, startLine, endLine) + slice,
      startLine,
      endLine,
    });

    if (end >= lines.length) break;
  }

  return chunks;
}
