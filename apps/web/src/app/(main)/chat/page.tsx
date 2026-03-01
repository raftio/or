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

interface WorkspaceEvent {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

type EventStreamStatus = "connecting" | "connected" | "disconnected" | "error";

function getTextFromParts(parts?: { type: string; text?: string }[]): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && !!p.text)
    .map((p) => p.text)
    .join("");
}

// ── SSE hook for workspace events ─────────────────────────────────────────

function useWorkspaceEvents(workspaceId: string | undefined, token: string | null) {
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [streamStatus, setStreamStatus] = useState<EventStreamStatus>("disconnected");
  const [streamError, setStreamError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptRef = useRef(0);
  const MAX_EVENTS = 100;
  const MAX_RECONNECT_DELAY = 30_000;

  const connect = useCallback(() => {
    if (!workspaceId || !token) return;
    eventSourceRef.current?.close();
    setStreamStatus("connecting");
    setStreamError(null);

    const url = `${apiUrl}/v1/workspaces/${workspaceId}/events/stream`;
    const es = new EventSource(url, { withCredentials: false });

    // EventSource doesn't support custom headers natively, so we use a
    // fetch-based polyfill pattern: override with a custom ReadableStream reader
    es.close();

    const abortController = new AbortController();
    eventSourceRef.current = null;

    (async () => {
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abortController.signal,
        });

        if (!res.ok) {
          setStreamStatus("error");
          setStreamError(`Event stream returned ${res.status}`);
          scheduleReconnect();
          return;
        }

        setStreamStatus("connected");
        reconnectAttemptRef.current = 0;

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (currentEventType === "workspace_event" && data) {
                try {
                  const parsed = JSON.parse(data) as WorkspaceEvent;
                  setEvents((prev) => {
                    const next = [parsed, ...prev];
                    return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
                  });
                } catch { /* malformed JSON */ }
              }
              currentEventType = "";
            } else if (line === "") {
              currentEventType = "";
            }
          }
        }

        setStreamStatus("disconnected");
        scheduleReconnect();
      } catch (err) {
        if (abortController.signal.aborted) return;
        setStreamStatus("error");
        setStreamError(err instanceof Error ? err.message : "Connection failed");
        scheduleReconnect();
      }
    })();

    eventSourceRef.current = { close: () => abortController.abort() } as unknown as EventSource;
  }, [workspaceId, token]);

  function scheduleReconnect() {
    const attempt = reconnectAttemptRef.current++;
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY);
    reconnectTimerRef.current = setTimeout(() => connect(), delay);
  }

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      clearTimeout(reconnectTimerRef.current);
      setStreamStatus("disconnected");
    };
  }, [connect]);

  const dismissEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, streamStatus, streamError, dismissEvent, clearEvents, reconnect: connect };
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
  listBundles:      { label: "Bundles",         icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  getBundle:        { label: "Bundle Details",   icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
  createBundle:     { label: "Bundle Created",   icon: "M12 5v14M5 12h14" },
  listEvidence:     { label: "Evidence",         icon: "M9 11l3 3L22 4" },
  getEvidenceStatus:{ label: "Evidence Status",  icon: "M9 11l3 3L22 4" },
  saveMemory:       { label: "Noted",            icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  recallMemories:   { label: "Memories",         icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  getTicket:        { label: "Ticket Details",   icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5Z" },
  listTickets:      { label: "Tickets",          icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5Z" },
  createTicket:     { label: "Ticket Created",   icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5Z" },
  searchCode:       { label: "Code Search",      icon: "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0m4 4l6 6" },
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

// ── Event display components ──────────────────────────────────────────────

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  "bundle.created":            { icon: "M12 5v14M5 12h14",            color: "text-green-500" },
  "bundle.updated":            { icon: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z", color: "text-blue-500" },
  "bundle.synced":             { icon: "M23 4v6h-6M1 20v-6h6",        color: "text-indigo-500" },
  "evidence.submitted":        { icon: "M9 11l3 3L22 4",              color: "text-amber-500" },
  "evidence.validated":        { icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14", color: "text-green-500" },
  "task.started":              { icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", color: "text-blue-500" },
  "task.completed":            { icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", color: "text-green-500" },
  "integration.connected":     { icon: "M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3", color: "text-purple-500" },
  "integration.disconnected":  { icon: "M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3", color: "text-red-400" },
};

function EventCard({ event, onDismiss }: { event: WorkspaceEvent; onDismiss: () => void }) {
  const meta = EVENT_ICONS[event.type] ?? { icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", color: "text-base-text-muted" };
  const time = new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-base-border bg-surface/80 px-3 py-2 text-xs animate-in slide-in-from-top-1 fade-in duration-200">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mt-0.5 shrink-0 ${meta.color}`}>
        <path d={meta.icon} />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-base-text">{event.title}</div>
        {Object.keys(event.detail).length > 0 && (
          <div className="mt-0.5 text-base-text-muted">
            {"ticketRef" in event.detail && <span className="font-mono">{String(event.detail.ticketRef)}</span>}
            {"repo" in event.detail && <span className="font-mono"> {String(event.detail.repo)}</span>}
          </div>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-base-text-muted">{time}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-base-text-muted opacity-0 transition-opacity hover:text-base-text group-hover:opacity-100"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function EventStreamIndicator({ status, error, onReconnect }: { status: EventStreamStatus; error: string | null; onReconnect: () => void }) {
  if (status === "connected") return null;

  const config: Record<Exclude<EventStreamStatus, "connected">, { label: string; className: string; showRetry: boolean }> = {
    connecting:    { label: "Connecting to event stream...", className: "text-amber-500", showRetry: false },
    disconnected:  { label: "Event stream disconnected",    className: "text-base-text-muted", showRetry: true },
    error:         { label: error ?? "Event stream error",  className: "text-red-400", showRetry: true },
  };

  const { label, className, showRetry } = config[status];

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 text-xs ${className}`}>
      {status === "connecting" && (
        <div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
      )}
      {status === "error" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <span>{label}</span>
      {showRetry && (
        <button type="button" onClick={onReconnect} className="underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
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
  const [showEvents, setShowEvents] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { events, streamStatus, streamError, dismissEvent, clearEvents, reconnect } =
    useWorkspaceEvents(workspaceId, token);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const conversationIdRef = useRef(activeConversationId);
  conversationIdRef.current = activeConversationId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/v1/workspaces/${workspaceId}/chat`,
        headers: () => tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : ({} as Record<string, string>),
        fetch: async (url, init) => {
          const res = await globalThis.fetch(url, init);
          const convIdHeader = res.headers.get("X-Conversation-Id");
          if (convIdHeader && !conversationIdRef.current) {
            conversationIdRef.current = convIdHeader;
            setActiveConversationId(convIdHeader);
          }
          return res;
        },
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

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEvents((p) => !p)}
              className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
              title="Toggle event feed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {events.length}
              </span>
            </button>
          )}

          {streamStatus !== "connected" && streamStatus !== "disconnected" && (
            <div className={`h-2 w-2 rounded-full ${streamStatus === "connecting" ? "animate-pulse bg-amber-400" : "bg-red-400"}`}
              title={streamStatus === "connecting" ? "Connecting..." : streamError ?? "Error"} />
          )}
          {streamStatus === "connected" && (
            <div className="h-2 w-2 rounded-full bg-green-400" title="Live" />
          )}

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

      {/* Event stream status */}
      <EventStreamIndicator status={streamStatus} error={streamError} onReconnect={reconnect} />

      {/* Live events feed */}
      {showEvents && events.length > 0 && (
        <div className="shrink-0 border-b border-base-border bg-surface/50">
          <div className="mx-auto max-w-2xl px-4 py-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-base-text-muted">
                Live Events
              </span>
              <button
                type="button"
                onClick={clearEvents}
                className="text-[10px] text-base-text-muted hover:text-base-text"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-1.5" style={{ maxHeight: "160px", overflowY: "auto" }}>
              {events.slice(0, 10).map((event) => (
                <EventCard key={event.id} event={event} onDismiss={() => dismissEvent(event.id)} />
              ))}
              {events.length > 10 && (
                <div className="text-center text-[10px] text-base-text-muted">
                  +{events.length - 10} more events
                </div>
              )}
            </div>
          </div>
        </div>
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
                  <div className="flex items-center gap-2 text-xs text-base-text-muted">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-base-border border-t-primary" />
                    <span>{status === "submitted" ? "Thinking..." : "Responding..."}</span>
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
