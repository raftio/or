"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "../../../components/auth-provider";
import { useWorkspace } from "../../../components/workspace-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

function getTextFromParts(parts?: { type: string; text?: string }[]): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && !!p.text)
    .map((p) => p.text)
    .join("");
}

const suggestions = [
  { label: "What bundles do I have?", icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  { label: "Show me recent tasks", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { label: "Help me create a bundle", icon: "M12 5v14M5 12h14" },
];

// ── Markdown renderer ─────────────────────────────────────────────────────

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={elements.length} className="my-2 overflow-x-auto rounded-lg bg-base p-3 text-xs leading-relaxed">
          {lang && <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-base-text-muted">{lang}</div>}
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={elements.length} className="h-2" />);
      i++;
      continue;
    }

    elements.push(
      <p key={elements.length} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        <code key={parts.length} className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-primary">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// ── Tool result rendering ─────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  listBundles:      { label: "Bundles",        icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  getBundle:        { label: "Bundle Details",  icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  createBundle:     { label: "Bundle Created",  icon: "M12 5v14M5 12h14" },
  listEvidence:     { label: "Evidence",        icon: "M9 11l3 3L22 4" },
  getEvidenceStatus:{ label: "Evidence Status", icon: "M9 11l3 3L22 4" },
  saveMemory:       { label: "Noted",           icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  recallMemories:   { label: "Memories",        icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
};

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "partial-call" | "result";
  result?: unknown;
}

function ToolResultCard({ invocation }: { invocation: ToolInvocation }) {
  const meta = TOOL_LABELS[invocation.toolName] ?? { label: invocation.toolName, icon: "" };

  if (invocation.state === "call" || invocation.state === "partial-call") {
    return (
      <div className="my-1.5 flex items-center gap-2 rounded-lg border border-base-border bg-base/50 px-3 py-2 text-xs text-base-text-muted">
        <div className="h-3 w-3 animate-spin rounded-full border border-base-border border-t-primary" />
        <span>Using {meta.label}...</span>
      </div>
    );
  }

  const result = invocation.result as Record<string, unknown> | undefined;
  if (!result) return null;

  if (invocation.toolName === "saveMemory") {
    return (
      <div className="my-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={meta.icon} />
        </svg>
        Saved to memory
      </div>
    );
  }

  if (invocation.toolName === "createBundle") {
    const tasks = (result.tasks ?? []) as { id: string; title: string }[];
    return (
      <div className="my-1.5 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-medium text-green-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Bundle created — {result.ticketRef as string}
        </div>
        {tasks.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-base-text-muted">
            {tasks.map((t) => (
              <li key={t.id}>
                <span className="font-mono text-primary/70">{t.id}</span> {t.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (invocation.toolName === "recallMemories") {
    if (!(result.found as boolean)) {
      return (
        <div className="my-1.5 rounded-lg border border-base-border bg-base/50 px-3 py-2 text-xs text-base-text-muted italic">
          No matching memories found.
        </div>
      );
    }
    const memories = (result.memories ?? []) as { id: string; category: string; content: string; createdAt: string }[];
    return (
      <div className="my-1.5 space-y-1.5">
        {memories.map((m) => (
          <div key={m.id} className="rounded-lg border border-base-border bg-base/50 px-3 py-2 text-xs">
            <span className="mr-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
              {m.category}
            </span>
            <span className="text-base-text">{m.content}</span>
          </div>
        ))}
      </div>
    );
  }

  // Generic fallback for listBundles, listEvidence, etc.
  return (
    <details className="my-1.5 rounded-lg border border-base-border bg-base/50 text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 font-medium text-base-text-muted hover:text-base-text">
        {meta.icon && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={meta.icon} />
          </svg>
        )}
        {meta.label}
        {"total" in result && <span className="ml-auto text-base-text-muted">({result.total as number})</span>}
      </summary>
      <pre className="overflow-x-auto border-t border-base-border px-3 py-2 text-[11px] leading-relaxed text-base-text-muted">
        {JSON.stringify(result, null, 2)}
      </pre>
    </details>
  );
}

// ── Message part renderer ─────────────────────────────────────────────────

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: ToolInvocation;
}

function MessageParts({ parts, isUser }: { parts: MessagePart[]; isUser: boolean }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text" && part.text) {
          return isUser ? (
            <div key={i} className="whitespace-pre-wrap">{part.text}</div>
          ) : (
            <SimpleMarkdown key={i} content={part.text} />
          );
        }
        if (part.type === "tool-invocation" && part.toolInvocation) {
          return <ToolResultCard key={i} invocation={part.toolInvocation} />;
        }
        return null;
      })}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { token } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center text-base-text-muted">
        Select a workspace to start chatting.
      </div>
    );
  }

  return <ChatInner key={workspaceId} workspaceId={workspaceId} token={token} />;
}

function ChatInner({ workspaceId, token }: { workspaceId: string; token: string | null }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const conversationIdRef = useRef(activeConversationId);
  conversationIdRef.current = activeConversationId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/v1/workspaces/${workspaceId}/chat`,
        headers: () => tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : ({} as Record<string, string>),
        prepareSendMessagesRequest({ messages, body, headers, api, credentials }) {
          const simplified = messages.map((m) => ({
            role: m.role,
            content: getTextFromParts(m.parts as { type: string; text?: string }[]),
          }));
          return {
            api,
            headers,
            credentials,
            body: {
              ...body,
              messages: simplified,
              conversationId: conversationIdRef.current ?? undefined,
            },
          };
        },
      }),
    [workspaceId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onFinish() {
      fetchConversations();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const fetchConversations = useCallback(async () => {
    setSidebarLoading(true);
    try {
      const res = await fetch(
        `${apiUrl}/v1/workspaces/${workspaceId}/chat/conversations?limit=50`,
        { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined },
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      /* network error */
    } finally {
      setSidebarLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const loadConversation = useCallback(
    async (convId: string) => {
      setActiveConversationId(convId);
      setShowPanel(false);
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/conversations/${convId}`,
          { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined },
        );
        if (res.ok) {
          const data = await res.json();
          const loaded = (data.messages ?? []).map(
            (m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
            }),
          );
          setMessages(loaded);
        }
      } catch {
        /* network error */
      }
    },
    [workspaceId, setMessages],
  );

  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setShowPanel(false);
  }, [setMessages]);

  const deleteConversation = useCallback(
    async (convId: string) => {
      try {
        await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/conversations/${convId}`,
          { method: "DELETE", headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined },
        );
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (conversationIdRef.current === convId) {
          startNewChat();
        }
      } catch {
        /* network error */
      }
    },
    [workspaceId, startNewChat],
  );

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? inputValue).trim();
      if (!msg || isLoading) return;
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      sendMessage({ text: msg });
    },
    [inputValue, isLoading, sendMessage],
  );

  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title;

  return (
    <div className="relative flex h-full flex-col">
      {/* Header bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-base-border bg-surface px-4">
        <button
          type="button"
          onClick={() => setShowPanel((p) => !p)}
          className="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
          title="Toggle conversations"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showPanel ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>

        <span className="flex-1 truncate text-sm font-medium text-base-text">
          {activeTitle ?? "New conversation"}
        </span>

        <button
          type="button"
          onClick={startNewChat}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Conversation panel (slide-over) */}
      {showPanel && (
        <>
          <div className="absolute inset-0 top-12 z-20 bg-black/20" onClick={() => setShowPanel(false)} />
          <div className="absolute left-0 top-12 bottom-0 z-30 flex w-72 flex-col border-r border-base-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-base-text-muted">
                Conversations
              </span>
              <span className="text-xs text-base-text-muted">
                {conversations.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarLoading && conversations.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-base-text-muted">
                  No conversations yet
                </p>
              ) : (
                <ul className="flex flex-col py-1">
                  {conversations.map((conv) => (
                    <li key={conv.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => loadConversation(conv.id)}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          conv.id === activeConversationId
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-base-text-muted hover:bg-primary/5 hover:text-base-text"
                        }`}
                      >
                        <span className="block truncate pr-6">{conv.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-base-text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="mb-1.5 text-lg font-semibold text-base-text">
              Orca Assistant
            </h3>
            <p className="mb-8 max-w-sm text-sm text-base-text-muted">
              Ask about your bundles, tasks, or anything related to your workspace.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleSend(s.label)}
                  className="flex items-center gap-2.5 rounded-xl border border-base-border bg-surface px-4 py-3 text-left text-sm text-base-text-muted transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-base-text"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary/60">
                    <path d={s.icon} />
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    msg.role === "user"
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/15 text-secondary"
                  }`}
                >
                  {msg.role === "user" ? "U" : "O"}
                </div>
                <div
                  className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-base"
                      : "border border-base-border bg-surface text-base-text"
                  }`}
                >
                  <MessageParts
                    parts={msg.parts as MessagePart[]}
                    isUser={msg.role === "user"}
                  />
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-semibold text-secondary">
                  O
                </div>
                <div className="rounded-2xl border border-base-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-base-border bg-surface px-3 py-2 shadow-sm focus-within:border-primary">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Orca Assistant..."
            rows={1}
            className="flex-1 resize-none bg-transparent py-1 text-sm text-base-text placeholder:text-base-text-muted focus:outline-none"
            style={{ maxHeight: "160px" }}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isLoading || !inputValue.trim()}
            className="mb-0.5 shrink-0 rounded-lg bg-primary p-1.5 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
