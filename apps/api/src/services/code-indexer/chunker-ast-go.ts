/**
 * AST-aware chunker for Go files using tree-sitter.
 *
 * Parses Go source with web-tree-sitter and emits one chunk per
 * top-level declaration (function, method, type, var, const).
 * Consecutive imports are grouped into a single chunk.
 * Large type declarations (> maxChunkLines) with struct/interface
 * bodies are split by their fields/methods.
 *
 * Falls back to the line-based chunker when parsing fails.
 */
import { Parser, Language, type Node } from "web-tree-sitter";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";

const DEFAULT_MAX_CHUNK_LINES = 80;

const require_ = createRequire(import.meta.url);

let initPromise: Promise<Parser> | null = null;

function ensureParser(): Promise<Parser> {
  if (!initPromise) {
    initPromise = (async () => {
      await Parser.init();
      const parser = new Parser();
      const wasmPath = join(
        dirname(require_.resolve("tree-sitter-go/package.json")),
        "tree-sitter-go.wasm",
      );
      const Go = await Language.load(wasmPath);
      parser.setLanguage(Go);
      return parser;
    })();
  }
  return initPromise;
}

function preamble(
  filePath: string,
  language: string | null,
  startLine: number,
  endLine: number,
  symbol?: string,
): string {
  const lang = language ? ` [${language}]` : "";
  const sym = symbol ? ` — ${symbol}` : "";
  return `// File: ${filePath} (lines ${startLine}-${endLine})${lang}${sym}\n`;
}

function extractSymbol(node: Node): string | undefined {
  switch (node.type) {
    case "function_declaration": {
      const name = node.childForFieldName("name");
      return name ? `func ${name.text}` : undefined;
    }

    case "method_declaration": {
      const recv = node.childForFieldName("receiver");
      const name = node.childForFieldName("name");
      return name ? `func ${recv?.text ?? "()"} ${name.text}` : undefined;
    }

    case "type_declaration": {
      const specs = node.namedChildren.filter(
        (c) => c.type === "type_spec" || c.type === "type_alias",
      );
      if (specs.length === 1) {
        const name = specs[0].childForFieldName("name");
        return name ? `type ${name.text}` : undefined;
      }
      if (specs.length > 1) {
        const names = specs
          .map((s) => s.childForFieldName("name")?.text)
          .filter(Boolean);
        return `type (${names.join(", ")})`;
      }
      return undefined;
    }

    case "var_declaration": {
      const specs = node.namedChildren.filter((c) => c.type === "var_spec");
      const names = specs.flatMap((s) =>
        s.namedChildren.filter((c) => c.type === "identifier").map((c) => c.text),
      );
      return names.length ? `var ${names.join(", ")}` : undefined;
    }

    case "const_declaration": {
      const specs = node.namedChildren.filter((c) => c.type === "const_spec");
      const names = specs.flatMap((s) =>
        s.namedChildren.filter((c) => c.type === "identifier").map((c) => c.text),
      );
      return names.length ? `const ${names.join(", ")}` : undefined;
    }

    case "package_clause":
      return "package";

    default:
      return undefined;
  }
}

/**
 * For large type declarations (struct/interface), return the
 * field/method child nodes that can be used to split the chunk.
 */
function getTypeMembers(node: Node): Node[] | null {
  if (node.type !== "type_declaration") return null;

  const specs = node.namedChildren.filter(
    (c) => c.type === "type_spec" || c.type === "type_alias",
  );
  if (specs.length !== 1) return null;

  const typeNode = specs[0].childForFieldName("type");
  if (!typeNode) return null;

  if (typeNode.type === "struct_type") {
    const fieldList = typeNode.namedChildren.find(
      (c) => c.type === "field_declaration_list",
    );
    const fields = fieldList?.namedChildren.filter(
      (c) => c.type === "field_declaration",
    );
    return fields && fields.length > 0 ? fields : null;
  }

  if (typeNode.type === "interface_type") {
    const members = typeNode.namedChildren.filter(
      (c) => c.type === "method_elem" || c.type === "type_elem",
    );
    return members.length > 0 ? members : null;
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

/** tree-sitter rows are 0-based; convert to 1-based line numbers. */
function startLine(node: Node): number {
  return node.startPosition.row + 1;
}
function endLine(node: Node): number {
  return node.endPosition.row + 1;
}

export async function chunkGo(
  filePath: string,
  content: string,
  language: string | null,
  maxChunkLines?: number,
  fallbackOptions?: ChunkOptions,
): Promise<CodeChunk[]> {
  let parser: Parser;
  try {
    parser = await ensureParser();
  } catch {
    return chunkCode(filePath, content, language, fallbackOptions);
  }

  const tree = parser.parse(content);
  if (!tree) {
    return chunkCode(filePath, content, language, fallbackOptions);
  }

  const root = tree.rootNode;
  const lines = content.split("\n");
  const max = maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
  const chunks: CodeChunk[] = [];
  const children = root.namedChildren;

  // Build list of declarations, absorbing leading comments into each one
  // so doc-comments are included in the same chunk as their declaration.
  interface Decl {
    node: Node;
    effectiveStart: number; // 1-based, may be earlier than node start due to comments
  }
  const decls: Decl[] = [];
  let pendingCommentStart: number | null = null;

  for (const child of children) {
    if (child.type === "comment") {
      if (pendingCommentStart === null) pendingCommentStart = startLine(child);
      continue;
    }
    decls.push({
      node: child,
      effectiveStart: pendingCommentStart ?? startLine(child),
    });
    pendingCommentStart = null;
  }

  let i = 0;
  while (i < decls.length) {
    const { node, effectiveStart: sl } = decls[i];

    if (node.type === "import_declaration") {
      let importEnd = endLine(node);
      let j = i + 1;
      while (j < decls.length && decls[j].node.type === "import_declaration") {
        importEnd = endLine(decls[j].node);
        j++;
      }
      chunks.push(nodeToChunk(lines, filePath, language, sl, importEnd, "imports"));
      i = j;
      continue;
    }

    const el = endLine(node);
    const nodeLines = el - sl + 1;
    const symbol = extractSymbol(node);

    if (nodeLines <= max) {
      chunks.push(nodeToChunk(lines, filePath, language, sl, el, symbol));
    } else {
      const members = getTypeMembers(node);
      if (members && members.length > 0) {
        const firstMemberLine = startLine(members[0]);
        if (firstMemberLine > sl) {
          chunks.push(nodeToChunk(lines, filePath, language, sl, firstMemberLine - 1, symbol));
        }

        for (const member of members) {
          chunks.push(
            nodeToChunk(lines, filePath, language, startLine(member), endLine(member)),
          );
        }

        const lastMemberEnd = endLine(members[members.length - 1]);
        if (lastMemberEnd < el) {
          chunks.push(nodeToChunk(lines, filePath, language, lastMemberEnd + 1, el));
        }
      } else {
        chunks.push(nodeToChunk(lines, filePath, language, sl, el, symbol));
      }
    }

    i++;
  }

  tree.delete();

  if (chunks.length === 0 && content.trim().length > 0) {
    return chunkCode(filePath, content, language, fallbackOptions);
  }

  return chunks;
}
