"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "../../../components/auth-provider";
import { useWorkspace } from "../../../components/workspace-provider";
import { ChatMarkdown } from "../../../components/chat-markdown";
import { ImageLightbox } from "../../../components/image-lightbox";
import { useNavbarSlot } from "../../../components/navbar-slot-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

interface PendingImage {
  id: string;
  url: string;
  filename: string;
  previewUrl: string;
  uploading: boolean;
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPEG and PNG images are allowed.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `Image exceeds the 5 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

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
  imageUrl?: string;
  imageFilename?: string;
}

function MessageParts({
  parts,
  isUser,
  onImageClick,
}: {
  parts: MessagePart[];
  isUser: boolean;
  onImageClick?: (imageUrl: string, allImages: { url: string; filename?: string }[]) => void;
}) {
  const imageUrls = parts
    .filter((p) => p.type === "image" && p.imageUrl)
    .map((p) => ({ url: p.imageUrl!, filename: p.imageFilename }));

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "image" && part.imageUrl) {
          return (
            <img
              key={i}
              src={part.imageUrl}
              alt={part.imageFilename ?? "Uploaded image"}
              className="my-1 max-h-64 max-w-full cursor-pointer rounded-lg"
              onClick={() => onImageClick?.(part.imageUrl!, imageUrls)}
            />
          );
        }
        if (part.type === "text" && part.text) {
          return isUser ? (
            <div key={i} className="whitespace-pre-wrap">{part.text}</div>
          ) : (
            <ChatMarkdown key={i} content={part.text} />
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

// ── Message action buttons ────────────────────────────────────────────────

function MessageActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
        title="Copy"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="rounded-md p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
        title="Good response"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        type="button"
        className="rounded-md p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
        title="Bad response"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
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
  const setNavbarSlot = useNavbarSlot();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: { url: string; filename?: string }[]; index: number } | null>(null);
  const [lastSentImages, setLastSentImages] = useState<PendingImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageIdsRef = useRef<string[]>([]);
  const imageIdsToSendRef = useRef<string[]>([]);

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
          const imageIds = imageIdsToSendRef.current.length > 0 ? [...imageIdsToSendRef.current] : undefined;
          imageIdsToSendRef.current = [];
          return {
            api,
            headers,
            credentials,
            body: {
              ...body,
              messages: simplified,
              conversationId: conversationIdRef.current ?? undefined,
              imageIds,
            },
          };
        },
      }),
    [workspaceId],
  );

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
    onFinish() {
      fetchConversations();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isStreaming = status === "streaming";

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  const loadConversation = useCallback(
    async (convId: string) => {
      setActiveConversationId(convId);
      setShowPanel(false);
      setLastSentImages([]);
      try {
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/conversations/${convId}`,
          { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined },
        );
        if (res.ok) {
          const data = await res.json();
          const loaded = (data.messages ?? []).map(
            (m: { id: string; role: string; content: string; image_ids?: string[] }) => {
              const parts: MessagePart[] = [];
              if (m.image_ids?.length) {
                for (const imgId of m.image_ids) {
                  parts.push({
                    type: "image" as const,
                    imageUrl: `${apiUrl}/v1/workspaces/${workspaceId}/chat/images/${imgId}`,
                    imageFilename: imgId,
                  });
                }
              }
              parts.push({ type: "text" as const, text: m.content });
              return { id: m.id, role: m.role as "user" | "assistant", parts };
            },
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
    setPendingImages([]);
    setLastSentImages([]);
    pendingImageIdsRef.current = [];
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

  const uploadImage = useCallback(
    async (file: File) => {
      setImageError(null);
      const error = validateImageFile(file);
      if (error) {
        setImageError(error);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const tempId = crypto.randomUUID();
      const pending: PendingImage = { id: tempId, url: "", filename: file.name, previewUrl, uploading: true };
      setPendingImages((prev) => [...prev, pending]);

      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(
          `${apiUrl}/v1/workspaces/${workspaceId}/chat/images`,
          {
            method: "POST",
            headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined,
            body: form,
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error ?? "Upload failed");
        }
        const data = await res.json() as { id: string; url: string; filename: string };
        setPendingImages((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: data.id, url: `${apiUrl}${data.url}`, uploading: false } : p)),
        );
        pendingImageIdsRef.current = [...pendingImageIdsRef.current, data.id];
      } catch (err) {
        setPendingImages((prev) => prev.filter((p) => p.id !== tempId));
        setImageError(err instanceof Error ? err.message : "Upload failed");
        URL.revokeObjectURL(previewUrl);
      }
    },
    [workspaceId],
  );

  const removeImage = useCallback((imageId: string) => {
    setPendingImages((prev) => {
      const img = prev.find((p) => p.id === imageId);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((p) => p.id !== imageId);
    });
    pendingImageIdsRef.current = pendingImageIdsRef.current.filter((id) => id !== imageId);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((f) => uploadImage(f));
    },
    [uploadImage],
  );

    const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? inputValue).trim();
      if (!msg || isLoading) return;
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      // Snapshot image IDs so the transport can read them asynchronously
      imageIdsToSendRef.current = [...pendingImageIdsRef.current];
      const sentImages = [...pendingImages].filter((p) => !p.uploading);
      sendMessage({ text: msg });
      setLastSentImages(sentImages);
      setPendingImages([]);
      pendingImageIdsRef.current = [];
    },
    [inputValue, isLoading, sendMessage, pendingImages],
  );

  const openLightbox = useCallback(
    (clickedUrl: string, allImages: { url: string; filename?: string }[]) => {
      const index = allImages.findIndex((img) => img.url === clickedUrl);
      setLightbox({ images: allImages, index: index >= 0 ? index : 0 });
    },
    [],
  );

  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title;

  useEffect(() => {
    setNavbarSlot(
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setShowPanel((p: boolean) => !p)}
          className="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
          title="Toggle conversations"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="max-w-[220px] truncate text-[13px] font-medium text-base-text">
          {activeTitle ?? "New conversation"}
        </span>
        {streamStatus !== "connected" && streamStatus !== "disconnected" && (
          <div className={`h-2 w-2 rounded-full ${streamStatus === "connecting" ? "animate-pulse bg-amber-400" : "bg-red-400"}`}
            title={streamStatus === "connecting" ? "Connecting..." : streamError ?? "Error"} />
        )}
        {activeConversationId && (
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
            title="New Chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}
      </div>,
    );
    return () => setNavbarSlot(null);
  }, [activeConversationId, activeTitle, streamStatus, streamError, startNewChat, setNavbarSlot, setShowPanel]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Conversation panel (slide-over) */}
      {showPanel && (
        <>
          <div className="absolute inset-0 z-20 bg-black/20" onClick={() => setShowPanel(false)} />
          <div className="absolute left-0 top-0 bottom-0 z-30 flex w-72 flex-col border-r border-base-border bg-surface shadow-xl">
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
            <div className="mx-auto max-w-3xl px-4 py-2">
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <h3 className="mb-6 text-2xl font-semibold text-base-text">
              What can I help with?
            </h3>

            <div className="flex flex-wrap justify-center gap-2.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleSend(s.label)}
                  className="rounded-full border border-base-border bg-surface px-4 py-2.5 text-sm text-base-text-muted transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-base-text"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.map((msg, msgIdx) => {
              const isLastUserMsg = msg.role === "user" && lastSentImages.length > 0 &&
                !messages.slice(msgIdx + 1).some((m) => m.role === "user");
              const extraParts: MessagePart[] = isLastUserMsg
                ? lastSentImages.map((img) => ({
                    type: "image" as const,
                    imageUrl: img.previewUrl || img.url,
                    imageFilename: img.filename,
                  }))
                : [];
              const allParts = [...extraParts, ...((msg.parts as MessagePart[]) ?? [])];
              const textContent = getTextFromParts(msg.parts as { type: string; text?: string }[]);

              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="mb-5 flex justify-end">
                    <div className="max-w-[80%] rounded-3xl bg-surface px-5 py-3 text-sm text-base-text">
                      <MessageParts
                        parts={allParts}
                        isUser
                        onImageClick={openLightbox}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="group/msg mb-5">
                  <div className="text-sm text-base-text">
                    <MessageParts
                      parts={allParts}
                      isUser={false}
                      onImageClick={openLightbox}
                    />
                  </div>
                  <MessageActions text={textContent} />
                </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 py-2">
                  <span className="h-2 w-2 rounded-full bg-base-text-muted/60 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-base-text-muted/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-base-text-muted/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && messages.length > 0 && (
        <div className="pointer-events-none absolute bottom-28 left-0 right-0 flex justify-center">
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto rounded-full border border-base-border bg-surface p-2 shadow-md transition-all hover:bg-primary/5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-text-muted">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        {/* Stop button */}
        {isStreaming && (
          <div className="mx-auto mb-2 flex max-w-3xl justify-center">
            <button
              type="button"
              onClick={() => stop()}
              className="flex items-center gap-1.5 rounded-full border border-base-border bg-surface px-3.5 py-1.5 text-xs font-medium text-base-text-muted shadow-sm transition-colors hover:bg-primary/5 hover:text-base-text"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop generating
            </button>
          </div>
        )}
        <div
          className={`mx-auto max-w-3xl rounded-3xl border bg-surface shadow-sm transition-colors focus-within:border-primary/50 ${
            dragOver ? "border-primary bg-primary/5" : "border-base-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
        >
          {/* Image error */}
          {imageError && (
            <div className="flex items-center gap-2 px-4 pt-3 text-xs text-red-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{imageError}</span>
              <button type="button" onClick={() => setImageError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Pending image previews */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {pendingImages.map((img) => (
                <div key={img.id} className="group relative">
                  <img
                    src={img.previewUrl}
                    alt={img.filename}
                    className={`h-16 w-16 rounded-lg object-cover ${img.uploading ? "opacity-50" : ""}`}
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Textarea + buttons */}
          <div className="flex items-end gap-2 px-4 py-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-0.5 shrink-0 rounded-full p-1.5 text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
              title="Attach image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
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
              onPaste={(e) => {
                const items = e.clipboardData.items;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                      e.preventDefault();
                      uploadImage(file);
                    }
                  }
                }
              }}
              placeholder="Ask anything"
              rows={1}
              className="flex-1 resize-none bg-transparent py-1 text-sm text-base-text placeholder:text-base-text-muted focus:outline-none"
              style={{ maxHeight: "160px" }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
