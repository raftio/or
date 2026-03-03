"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MemoryManagement } from "./memory-management";

interface PersonalizePopupProps {
  open: boolean;
  onClose: () => void;
}

export function PersonalizePopup({ open, onClose }: PersonalizePopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [instructions, setInstructions] = useState("");
  const [showMemories, setShowMemories] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowMemories(false);
      setAddingMemory(false);
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Personalize"
        className="relative z-10 flex w-full max-w-lg flex-col rounded-xl bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-base-border px-6 py-4">
          <h2 className="text-lg font-semibold text-base-text">Personalize</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-base-text-muted transition-colors hover:bg-base hover:text-base-text"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col overflow-y-auto px-6 py-5">
          <label
            htmlFor="custom-instructions"
            className="block text-sm font-medium text-base-text"
          >
            Custom Instructions
          </label>
          <p className="mt-1 text-xs text-base-text-muted">
            Tell OR how you'd like it to respond. These instructions apply to
            every conversation.
          </p>
          <textarea
            id="custom-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Always respond concisely. Prefer TypeScript examples."
            rows={4}
            className="mt-3 w-full resize-none rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-base-text placeholder:text-base-text-muted focus:border-primary focus:outline-none"
          />

          <div className="mt-6 border-t border-base-border pt-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowMemories((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-base-text-muted transition-colors hover:bg-primary/5 hover:text-base-text"
              >
                Manage Memories
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-150 ${showMemories ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {showMemories && (
                <button
                  type="button"
                  onClick={() => setAddingMemory(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              )}
            </div>

            {showMemories && (
              <div className="mt-3">
                <MemoryManagement adding={addingMemory} onAddingChange={setAddingMemory} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
