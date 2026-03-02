"use client";

import { memo, useCallback, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.min.css";

function extractLang(children: ReactNode): string {
  if (!children || typeof children !== "object") return "";
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === "object" && "props" in child) {
    const cls: string = child.props?.className ?? "";
    const match = cls.match(/language-(\S+)/);
    if (match) return match[1];
  }
  return "";
}

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = extractLang(children);

  const handleCopy = useCallback(() => {
    const text = preRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <div className="group/code relative my-2.5 overflow-hidden rounded-lg border border-base-border first:mt-0 last:mb-0">
      <div className="flex items-center justify-between bg-surface-alt px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-base-text-muted">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-base-text-muted transition-colors hover:text-base-text"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre ref={preRef} className="overflow-x-auto bg-surface dark:bg-[#1a1a1a] p-3 text-xs leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-bold leading-tight text-base-text first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2.5 mt-4 text-lg font-semibold leading-tight text-base-text first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3.5 text-base font-semibold leading-snug text-base-text first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-base-text first:mt-0">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-2.5 text-sm font-medium text-base-text first:mt-0">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-2.5 text-xs font-medium uppercase tracking-wide text-base-text-muted first:mt-0">
      {children}
    </h6>
  ),

  p: ({ children }) => (
    <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
    >
      {children}
    </a>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-base-text">{children}</strong>
  ),

  em: ({ children }) => <em className="italic">{children}</em>,

  del: ({ children }) => (
    <del className="text-base-text-muted line-through">{children}</del>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-2 border-primary/40 pl-3 text-base-text-muted first:mt-0">
      {children}
    </blockquote>
  ),

  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    const isChecked = (props as Record<string, unknown>).checked;
    if (typeof isChecked === "boolean") {
      return (
        <li className="flex items-start gap-2 list-none -ml-5">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] ${
              isChecked
                ? "bg-primary text-base"
                : "bg-surface-alt"
            }`}
          >
            {isChecked && "✓"}
          </span>
          <span className={isChecked ? "text-base-text-muted line-through" : ""}>
            {children}
          </span>
        </li>
      );
    }
    return <li className="leading-relaxed">{children}</li>;
  },

  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ children, className, ...rest }) => {
    const isBlock = className?.includes("language-") || className?.includes("hljs");
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-primary">
        {children}
      </code>
    );
  },

  hr: () => <hr className="my-4 border-base-border" />,

  table: ({ children }) => (
    <div className="my-2.5 overflow-x-auto rounded-lg first:mt-0">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-base/60 text-xs font-medium uppercase tracking-wide text-base-text-muted">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-base/30">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-base-text">{children}</td>
  ),

  img: (props: ComponentPropsWithoutRef<"img">) => (
    <img
      {...props}
      alt={props.alt ?? ""}
      className="my-2 max-w-full rounded-lg"
      loading="lazy"
    />
  ),
};

function ChatMarkdownInner({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

export const ChatMarkdown = memo(ChatMarkdownInner);
