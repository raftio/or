/**
 * Structure-aware chunker for CSS / SCSS / Less files.
 *
 * Splits by top-level rule blocks (selectors, @-rules) using brace counting.
 * Adjacent small rules are merged into a single chunk to avoid tiny fragments.
 *
 * Falls back to the line-based chunker when no blocks are found.
 */
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";

const DEFAULT_MAX_CHUNK_LINES = 80;
const MERGE_THRESHOLD_LINES = 8;

function preamble(
  filePath: string,
  startLine: number,
  endLine: number,
  symbol?: string,
): string {
  const sym = symbol ? ` — ${symbol}` : "";
  return `/* File: ${filePath} (lines ${startLine}-${endLine}) [css]${sym} */\n`;
}

interface CssBlock {
  selector: string;
  startLine: number;
  endLine: number;
}

/**
 * Extract a short symbol from the first line(s) of a CSS block.
 * Strips the opening brace and normalises whitespace.
 */
function extractSymbol(selector: string): string {
  const cleaned = selector
    .replace(/\{.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 80) return cleaned.slice(0, 77) + "...";
  return cleaned;
}

/**
 * Scan source lines for top-level CSS blocks using brace counting.
 * Returns blocks in source order.
 */
function findBlocks(lines: string[]): CssBlock[] {
  const blocks: CssBlock[] = [];
  let depth = 0;
  let blockStart = -1;
  let selectorLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (depth === 0 && blockStart === -1) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("/*") || trimmed.startsWith("//")) {
        continue;
      }
      // Start collecting a new selector / at-rule
      blockStart = i;
      selectorLines = [];
    }

    if (blockStart !== -1) {
      selectorLines.push(line);
    }

    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }

    if (depth <= 0 && blockStart !== -1) {
      blocks.push({
        selector: extractSymbol(selectorLines.join(" ")),
        startLine: blockStart + 1,
        endLine: i + 1,
      });
      blockStart = -1;
      selectorLines = [];
      depth = 0;
    }
  }

  // Unclosed block at EOF
  if (blockStart !== -1) {
    blocks.push({
      selector: extractSymbol(selectorLines.join(" ")),
      startLine: blockStart + 1,
      endLine: lines.length,
    });
  }

  return blocks;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

/**
 * Merge consecutive small blocks into combined chunks so we don't
 * produce dozens of tiny 2-line chunks for utility classes etc.
 */
function mergeSmallBlocks(blocks: CssBlock[], maxLines: number): CssBlock[] {
  if (blocks.length === 0) return [];

  const merged: CssBlock[] = [];
  let current = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const currentSize = current.endLine - current.startLine + 1;
    const blockSize = block.endLine - block.startLine + 1;
    const combinedSize = block.endLine - current.startLine + 1;

    if (
      currentSize <= MERGE_THRESHOLD_LINES &&
      blockSize <= MERGE_THRESHOLD_LINES &&
      combinedSize <= maxLines
    ) {
      current = {
        selector: current.selector,
        startLine: current.startLine,
        endLine: block.endLine,
      };
    } else {
      merged.push(current);
      current = { ...block };
    }
  }
  merged.push(current);

  return merged;
}

export function chunkCss(
  filePath: string,
  content: string,
  _language: string | null,
  maxChunkLines?: number,
  fallbackOptions?: ChunkOptions,
): CodeChunk[] {
  const lines = content.split("\n");
  const max = maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
  const rawBlocks = findBlocks(lines);

  if (rawBlocks.length === 0) {
    return chunkCode(filePath, content, "css", fallbackOptions);
  }

  const blocks = mergeSmallBlocks(rawBlocks, max);
  const chunks: CodeChunk[] = [];

  // Header: @import / @charset / @layer declarations before first block
  const firstBlockStart = blocks[0].startLine;
  if (firstBlockStart > 1) {
    const headerContent = sliceLines(lines, 1, firstBlockStart - 1).trimEnd();
    if (headerContent.length > 0) {
      chunks.push({
        content: preamble(filePath, 1, firstBlockStart - 1, "imports") + headerContent,
        startLine: 1,
        endLine: firstBlockStart - 1,
        symbol: "imports",
      });
    }
  }

  for (const block of blocks) {
    const symbol = block.selector;
    const blockSize = block.endLine - block.startLine + 1;

    if (blockSize <= max) {
      const text = sliceLines(lines, block.startLine, block.endLine);
      chunks.push({
        content: preamble(filePath, block.startLine, block.endLine, symbol) + text,
        startLine: block.startLine,
        endLine: block.endLine,
        symbol,
      });
    } else {
      for (let s = block.startLine; s <= block.endLine; s += max) {
        const e = Math.min(s + max - 1, block.endLine);
        const text = sliceLines(lines, s, e);
        const partSymbol = s === block.startLine ? symbol : `${symbol} (cont.)`;
        chunks.push({
          content: preamble(filePath, s, e, partSymbol) + text,
          startLine: s,
          endLine: e,
          symbol: partSymbol,
        });
      }
    }
  }

  return chunks;
}
