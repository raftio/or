"use client";

import { useCallback, useEffect, useState } from "react";

interface SuccessToastProps {
  message: string;
  /** Auto-dismiss delay in ms (default 5000). Pass 0 to disable. */
  duration?: number;
  onDismiss: () => void;
}

export function SuccessToast({
  message,
  duration = 5000,
  onDismiss,
}: SuccessToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    const id = setTimeout(onDismiss, 300);
    return () => clearTimeout(id);
  }, [onDismiss]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!duration) return;
    const id = setTimeout(dismiss, duration);
    return () => clearTimeout(id);
  }, [duration, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-green-500/30 bg-surface p-4 shadow-lg shadow-green-500/5 transition-all duration-300 ${
        visible && !exiting
          ? "translate-x-0 opacity-100"
          : "translate-x-8 opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-500"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>

      <div className="flex-1 pt-0.5">
        <p className="text-sm font-semibold text-green-500">Bundle Complete</p>
        <p className="mt-0.5 text-xs text-base-text-muted">{message}</p>
      </div>

      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-base-text-muted transition-colors hover:bg-base-border/30 hover:text-base-text"
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
