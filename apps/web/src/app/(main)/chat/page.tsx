"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
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
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const conversationIdRef = useRef(activeConversationId);
  conversationIdRef.current = activeConversationId;

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `${apiUrl}/v1/workspaces/${workspaceId}/chat`,
        headers: () => tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
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
      // network error
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

  const loadConversation = useCallback(
    async (convId: string) => {
      setActiveConversationId(convId);
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
        // network error
      }
    },
    [workspaceId, setMessages],
  );

  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
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
        // network error
      }
    },
    [workspaceId, startNewChat],
  );

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    sendMessage({ text });
  }, [inputValue, isLoading, sendMessage]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Conversation sidebar */}
      <div className="flex w-64 shrink-0 flex-col border-r border-base-border bg-surface-alt">
        <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
          <h2 className="text-sm font-semibold text-base-text">Conversations</h2>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-base transition-colors hover:bg-primary-hover"
          >
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebarLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-base-border border-t-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-base-text-muted">
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
                    <span className="block truncate">{conv.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-base-text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    title="Delete conversation"
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

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold text-base-text">
                Orca Assistant
              </h3>
              <p className="max-w-md text-sm text-base-text-muted">
                Ask about your bundles, tasks, evidence, or anything related to your workspace.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-base"
                        : "border border-base-border bg-surface text-base-text"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{getTextFromParts(msg.parts as { type: string; text?: string }[])}</div>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-base-border bg-surface px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-base-border bg-surface px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Orca Assistant..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-base-border bg-base px-4 py-3 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
              style={{ maxHeight: "120px" }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-base transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
