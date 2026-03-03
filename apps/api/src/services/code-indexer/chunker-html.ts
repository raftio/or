/**
 * Structure-aware chunker for HTML / template files.
 *
 * Splits by top-level semantic sections: <head>, <body> children,
 * <template>, <script>, <style>, and major structural tags.
 * Uses angle-bracket scanning (not a full parser) to stay lightweight.
 *
 * Falls back to the line-based chunker when no sections are found.
 */
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";

const DEFAULT_MAX_CHUNK_LINES = 100;

function preamble(
  filePath: string,
  startLine: number,
  endLine: number,
  symbol?: string,
): string {
  const sym = symbol ? ` — ${symbol}` : "";
  return `<!-- File: ${filePath} (lines ${startLine}-${endLine}) [html]${sym} -->\n`;
}

interface HtmlBlock {
  tag: string;
  id?: string;
  cls?: string;
  startLine: number;
  endLine: number;
}

const SECTION_TAGS = new Set([
  "head", "header", "footer", "nav", "main", "aside",
  "section", "article", "form", "table", "template",
  "script", "style", "div", "ul", "ol",
]);

/** Tags that are transparent wrappers — we skip them and scan children. */
const WRAPPER_TAGS = new Set(["html", "body"]);

const OPEN_TAG_RE = /^(\s*)<(\w+)([^>]*)>/;
const SELF_CLOSING_RE = /\/>\s*$/;
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function extractAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m?.[1];
}

function symbolFor(block: HtmlBlock): string {
  let sym = `<${block.tag}>`;
  if (block.id) sym = `<${block.tag}#${block.id}>`;
  else if (block.cls) sym = `<${block.tag}.${block.cls.split(/\s+/)[0]}>`;
  return sym;
}

/**
 * Find top-level semantic blocks by scanning for opening tags of
 * known section elements and counting nesting to find their close.
 */
function findBlocks(lines: string[]): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = OPEN_TAG_RE.exec(lines[i]);
    if (!match) { i++; continue; }

    const indent = match[1].length;
    const tag = match[2].toLowerCase();
    const attrs = match[3];

    if (WRAPPER_TAGS.has(tag)) { i++; continue; }
    if (!SECTION_TAGS.has(tag)) { i++; continue; }
    if (SELF_CLOSING_RE.test(lines[i]) || VOID_TAGS.has(tag)) { i++; continue; }

    const alwaysCapture = tag === "head" || tag === "script"
      || tag === "style" || tag === "template";
    if (!alwaysCapture && indent > 6) { i++; continue; }

    const startLine = i + 1;
    const closeTag = `</${tag}>`;
    let depth = 0;
    let found = false;

    for (let j = i; j < lines.length; j++) {
      const lower = lines[j].toLowerCase();
      // Count all opens/closes of this tag on this line
      let pos = 0;
      while (pos < lower.length) {
        const openIdx = lower.indexOf(`<${tag}`, pos);
        const closeIdx = lower.indexOf(closeTag, pos);

        if (openIdx === -1 && closeIdx === -1) break;

        if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
          const afterTag = lower[openIdx + tag.length + 1];
          if (afterTag === " " || afterTag === ">" || afterTag === "/" || afterTag === undefined) {
            depth++;
          }
          pos = openIdx + 1;
        } else {
          depth--;
          pos = closeIdx + 1;
          if (depth <= 0) {
            blocks.push({
              tag,
              id: extractAttr(attrs, "id"),
              cls: extractAttr(attrs, "class"),
              startLine,
              endLine: j + 1,
            });
            i = j + 1;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }

    if (!found) {
      // Unclosed tag — take rest of file
      blocks.push({
        tag,
        id: extractAttr(attrs, "id"),
        cls: extractAttr(attrs, "class"),
        startLine,
        endLine: lines.length,
      });
      break;
    }
  }

  return blocks;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

export function chunkHtml(
  filePath: string,
  content: string,
  _language: string | null,
  maxChunkLines?: number,
  fallbackOptions?: ChunkOptions,
): CodeChunk[] {
  const lines = content.split("\n");
  const max = maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
  const blocks = findBlocks(lines);

  if (blocks.length === 0) {
    return chunkCode(filePath, content, "html", fallbackOptions);
  }

  const chunks: CodeChunk[] = [];

  // Header: DOCTYPE, <html> opening, etc. before first block
  const firstBlockStart = blocks[0].startLine;
  if (firstBlockStart > 1) {
    const headerContent = sliceLines(lines, 1, firstBlockStart - 1).trimEnd();
    if (headerContent.length > 0) {
      chunks.push({
        content: preamble(filePath, 1, firstBlockStart - 1, "doctype") + headerContent,
        startLine: 1,
        endLine: firstBlockStart - 1,
        symbol: "doctype",
      });
    }
  }

  // Gap content between blocks (loose markup between sections)
  let prevEnd = firstBlockStart - 1;

  for (const block of blocks) {
    // Content between previous block and this one
    if (block.startLine > prevEnd + 1) {
      const gapContent = sliceLines(lines, prevEnd + 1, block.startLine - 1).trimEnd();
      if (gapContent.trim().length > 0) {
        chunks.push({
          content: preamble(filePath, prevEnd + 1, block.startLine - 1) + gapContent,
          startLine: prevEnd + 1,
          endLine: block.startLine - 1,
        });
      }
    }

    const symbol = symbolFor(block);
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

    prevEnd = block.endLine;
  }

  // Trailing content after last block
  if (prevEnd < lines.length) {
    const trailing = sliceLines(lines, prevEnd + 1, lines.length).trimEnd();
    if (trailing.length > 0) {
      chunks.push({
        content: preamble(filePath, prevEnd + 1, lines.length) + trailing,
        startLine: prevEnd + 1,
        endLine: lines.length,
      });
    }
  }

  return chunks;
}
