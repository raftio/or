/**
 * Structure-aware chunker for Protocol Buffer (.proto) files.
 *
 * Uses regex-based block scanning to find top-level definitions
 * (message, service, enum, extend) and emits one chunk per block.
 * Optionally enriches symbol names via proto-parser AST.
 *
 * Falls back to the line-based chunker when no blocks are found.
 */
import {
  parse,
  SyntaxType,
  type ProtoDocument,
  type NamespaceBase,
} from "proto-parser";
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";

const DEFAULT_MAX_CHUNK_LINES = 120;

function preamble(
  filePath: string,
  startLine: number,
  endLine: number,
  symbol?: string,
): string {
  const sym = symbol ? ` — ${symbol}` : "";
  return `// File: ${filePath} (lines ${startLine}-${endLine}) [protobuf]${sym}\n`;
}

interface BlockInfo {
  kind: string;
  name: string;
  startLine: number;
  endLine: number;
}

const BLOCK_RE = /^\s*(message|service|enum|extend)\s+(\w+)\s*\{/;

/**
 * Scan source lines for top-level proto blocks using brace counting.
 */
function findBlocks(lines: string[]): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = BLOCK_RE.exec(lines[i]);
    if (!match) {
      i++;
      continue;
    }

    const kind = match[1];
    const name = match[2];
    const startLine = i + 1;
    let depth = 0;

    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0) {
        blocks.push({ kind, name, startLine, endLine: j + 1 });
        i = j + 1;
        break;
      }
      if (j === lines.length - 1) {
        blocks.push({ kind, name, startLine, endLine: j + 1 });
        i = j + 1;
      }
    }
  }

  return blocks;
}

/**
 * Walk the proto-parser AST to build a map of name → qualified symbol label.
 */
function collectSymbols(root: NamespaceBase): Map<string, string> {
  const symbols = new Map<string, string>();

  function walk(node: NamespaceBase, prefix: string) {
    if (!node.nested) return;
    for (const [name, child] of Object.entries(node.nested)) {
      const fullName = prefix ? `${prefix}.${name}` : name;
      switch (child.syntaxType) {
        case SyntaxType.MessageDefinition:
          symbols.set(name, `message ${fullName}`);
          break;
        case SyntaxType.ServiceDefinition:
          symbols.set(name, `service ${fullName}`);
          break;
        case SyntaxType.EnumDefinition:
          symbols.set(name, `enum ${fullName}`);
          break;
        default:
          symbols.set(name, fullName);
      }
      walk(child, fullName);
    }
  }

  walk(root, "");
  return symbols;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

export function chunkProto(
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
    return chunkCode(filePath, content, "protobuf", fallbackOptions);
  }

  // Try to enrich symbol names via proto-parser AST
  let symbols = new Map<string, string>();
  try {
    const result = parse(content, { keepCase: true, resolve: false });
    if (result.syntaxType === SyntaxType.ProtoDocument) {
      symbols = collectSymbols((result as ProtoDocument).root);
    }
  } catch {
    // AST enrichment is optional; blocks still work
  }

  const chunks: CodeChunk[] = [];

  // Header: syntax, package, imports (everything before first block)
  const firstBlockStart = blocks[0].startLine;
  if (firstBlockStart > 1) {
    const headerEnd = firstBlockStart - 1;
    const headerContent = sliceLines(lines, 1, headerEnd).trimEnd();
    if (headerContent.length > 0) {
      chunks.push({
        content: preamble(filePath, 1, headerEnd, "imports") + headerContent,
        startLine: 1,
        endLine: headerEnd,
        symbol: "imports",
      });
    }
  }

  for (const block of blocks) {
    const symbol = symbols.get(block.name) ?? `${block.kind} ${block.name}`;
    const blockLines = block.endLine - block.startLine + 1;

    if (blockLines <= max) {
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

  // Trailing content after last block
  const lastBlockEnd = blocks[blocks.length - 1].endLine;
  if (lastBlockEnd < lines.length) {
    const trailing = sliceLines(lines, lastBlockEnd + 1, lines.length).trimEnd();
    if (trailing.length > 0) {
      chunks.push({
        content: preamble(filePath, lastBlockEnd + 1, lines.length) + trailing,
        startLine: lastBlockEnd + 1,
        endLine: lines.length,
      });
    }
  }

  return chunks;
}
