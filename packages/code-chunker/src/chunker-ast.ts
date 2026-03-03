/**
 * AST-aware chunker for TypeScript / JavaScript files.
 *
 * Parses the source with typescript-estree and emits one chunk per
 * top-level declaration (function, class, interface, type, enum, variable).
 * Consecutive imports are grouped into a single chunk.
 * Large nodes (> maxChunkLines) are split by their members.
 *
 * Falls back to the line-based chunker when parsing fails.
 */
import { parse, AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/typescript-estree";
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";

const DEFAULT_MAX_CHUNK_LINES = 80;

type Node = TSESTree.ProgramStatement;

function preamble(filePath: string, language: string | null, startLine: number, endLine: number, symbol?: string): string {
  const lang = language ? ` [${language}]` : "";
  const sym = symbol ? ` — ${symbol}` : "";
  return `// File: ${filePath} (lines ${startLine}-${endLine})${lang}${sym}\n`;
}

function extractSymbol(node: Node): string | undefined {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return node.id ? `function ${node.id.name}` : "function (anonymous)";

    case AST_NODE_TYPES.ClassDeclaration:
      return node.id ? `class ${node.id.name}` : "class (anonymous)";

    case AST_NODE_TYPES.TSInterfaceDeclaration:
      return `interface ${node.id.name}`;

    case AST_NODE_TYPES.TSTypeAliasDeclaration:
      return `type ${node.id.name}`;

    case AST_NODE_TYPES.TSEnumDeclaration:
      return `enum ${node.id.name}`;

    case AST_NODE_TYPES.VariableDeclaration: {
      const names = node.declarations
        .map((d) => (d.id.type === AST_NODE_TYPES.Identifier ? d.id.name : null))
        .filter(Boolean);
      return names.length ? `${node.kind} ${names.join(", ")}` : undefined;
    }

    case AST_NODE_TYPES.ExportNamedDeclaration:
    case AST_NODE_TYPES.ExportDefaultDeclaration:
      if (node.declaration && "type" in node.declaration) {
        const inner = extractSymbol(node.declaration as Node);
        return inner ? `export ${inner}` : undefined;
      }
      return undefined;

    default:
      return undefined;
  }
}

function extractMemberSymbol(member: TSESTree.ClassElement): string | undefined {
  if (
    member.type === AST_NODE_TYPES.MethodDefinition ||
    member.type === AST_NODE_TYPES.PropertyDefinition
  ) {
    if (member.key.type === AST_NODE_TYPES.Identifier) {
      return member.key.name;
    }
  }
  return undefined;
}

/** Nodes whose body can be split into members when they're too large. */
function getClassBody(node: Node): TSESTree.ClassElement[] | null {
  const inner =
    node.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    node.type === AST_NODE_TYPES.ExportDefaultDeclaration
      ? (node.declaration as Node | null)
      : node;

  if (
    inner &&
    (inner.type === AST_NODE_TYPES.ClassDeclaration) &&
    inner.body?.body
  ) {
    return inner.body.body;
  }
  return null;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

function nodeToChunk(
  lines: string[],
  filePath: string,
  language: string | null,
  startLine: number,
  endLine: number,
  symbol?: string,
): CodeChunk {
  const content = sliceLines(lines, startLine, endLine);
  return {
    content: preamble(filePath, language, startLine, endLine, symbol) + content,
    startLine,
    endLine,
    symbol,
  };
}

export function chunkTypeScript(
  filePath: string,
  content: string,
  language: string | null,
  maxChunkLines?: number,
  fallbackOptions?: ChunkOptions,
): CodeChunk[] {
  let ast: TSESTree.Program;
  try {
    ast = parse(content, { loc: true, range: true, jsx: true });
  } catch {
    return chunkCode(filePath, content, language, fallbackOptions);
  }

  const lines = content.split("\n");
  const max = maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
  const chunks: CodeChunk[] = [];

  let i = 0;
  while (i < ast.body.length) {
    const node = ast.body[i];

    // Group consecutive imports into a single chunk
    if (node.type === AST_NODE_TYPES.ImportDeclaration) {
      const importStart = node.loc.start.line;
      let importEnd = node.loc.end.line;
      let j = i + 1;
      while (j < ast.body.length && ast.body[j].type === AST_NODE_TYPES.ImportDeclaration) {
        importEnd = ast.body[j].loc.end.line;
        j++;
      }
      chunks.push(nodeToChunk(lines, filePath, language, importStart, importEnd, "imports"));
      i = j;
      continue;
    }

    const startLine = node.loc.start.line;
    const endLine = node.loc.end.line;
    const nodeLines = endLine - startLine + 1;
    const symbol = extractSymbol(node);

    if (nodeLines <= max) {
      chunks.push(nodeToChunk(lines, filePath, language, startLine, endLine, symbol));
    } else {
      // Try splitting large classes by members
      const members = getClassBody(node);
      if (members && members.length > 0) {
        // Include the class signature (everything before first member) as its own chunk
        const firstMemberLine = members[0].loc.start.line;
        if (firstMemberLine > startLine) {
          chunks.push(
            nodeToChunk(lines, filePath, language, startLine, firstMemberLine - 1, symbol),
          );
        }

        for (const member of members) {
          const mSymbol = extractMemberSymbol(member);
          const fullSymbol = symbol && mSymbol ? `${symbol}.${mSymbol}` : mSymbol;
          chunks.push(
            nodeToChunk(
              lines,
              filePath,
              language,
              member.loc.start.line,
              member.loc.end.line,
              fullSymbol,
            ),
          );
        }
      } else {
        // Can't split further — emit the large node as-is
        chunks.push(nodeToChunk(lines, filePath, language, startLine, endLine, symbol));
      }
    }

    i++;
  }

  // If the file only had whitespace/comments and produced no chunks, fall back
  if (chunks.length === 0 && content.trim().length > 0) {
    return chunkCode(filePath, content, language, fallbackOptions);
  }

  return chunks;
}
